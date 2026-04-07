import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, User, ZaloConfig } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { randomInt } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCatalogService } from '../../prisma/tenant-catalog.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../../common/types/auth-user.type';
import { PermissionsService } from '../permissions/permissions.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface OtpConfig {
  enabled: boolean;
  channel: 'ZALO';
  apiUrl: string;
  otpTemplateId?: string;
  otpTemplateDataKey: string;
  otpPhoneOverride?: string;
  codeLength: number;
  ttlMinutes: number;
  resendCooldownSeconds: number;
  maxRetry: number;
  zaloConfig: ZaloConfig | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCatalogService: TenantCatalogService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private async buildAuthPayload(userId: string): Promise<AuthUser> {
    await this.permissionsService.ensureCatalog();

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        branch: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      tenantCode: this.prisma.getTenantCode(),
      tenantName: this.prisma.getTenantName(),
      branchId: user.branchId,
      branchName: user.branch?.name || '',
      roleCodes: user.roles.map((item) => item.role.code),
      roleNames: user.roles.map((item) => item.role.name),
      permissions: Array.from(
        new Set(
          user.roles.flatMap((item) =>
            item.role.permissions.map(
              (permission) => permission.permission.code,
            ),
          ),
        ),
      ),
    };
  }

  private async signTokens(user: AuthUser) {
    const accessToken = await this.jwtService.signAsync(user, {
      secret: this.configService.get<string>(
        'JWT_ACCESS_SECRET',
        'change_this_access_secret',
      ),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TTL', '15m') as any,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, username: user.username },
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'change_this_refresh_secret',
        ),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_TTL',
          '7d',
        ) as any,
      },
    );

    return { accessToken, refreshToken };
  }

  private clampNumber(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(Math.max(Math.round(value), min), max);
  }

  private asObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private normalizePhone(phone?: string | null) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('84')) return digits;
    if (digits.startsWith('0')) return `84${digits.slice(1)}`;
    return digits;
  }

  private maskPhone(phone: string) {
    const normalized = phone.trim();
    if (!normalized) return '';
    if (normalized.length <= 4) return normalized;
    const visiblePrefix = normalized.slice(0, 3);
    const visibleSuffix = normalized.slice(-3);
    return `${visiblePrefix}${'*'.repeat(Math.max(normalized.length - 6, 2))}${visibleSuffix}`;
  }

  private generateOtpCode(length: number) {
    const min = Number(`1${'0'.repeat(length - 1)}`);
    const max = Number(`9${'9'.repeat(length - 1)}`);
    return String(randomInt(min, max + 1));
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private otpChallengeView(challenge: {
    id: string;
    purpose: string;
    channel: string;
    deliveryTarget: string;
    expiresAt: Date;
    sentAt: Date | null;
    verifiedAt: Date | null;
    consumedAt: Date | null;
    attempts: number;
    maxAttempts: number;
    failureReason: string | null;
    createdAt: Date;
  }) {
    return {
      ...challenge,
      deliveryTarget: this.maskPhone(challenge.deliveryTarget),
    };
  }

  private async auditOtp(
    action: AuditAction,
    userId: string,
    branchId: string | null | undefined,
    entityId: string,
    beforeData?: unknown,
    afterData?: unknown,
  ) {
    await this.auditLogsService.write({
      module: 'auth',
      action,
      userId,
      branchId,
      entityType: 'login_otp',
      entityId,
      beforeData,
      afterData,
    });
  }

  private async getActiveZaloConfig(branchId?: string | null) {
    if (branchId) {
      const branchConfig = await this.prisma.zaloConfig.findFirst({
        where: { branchId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (branchConfig) {
        return branchConfig;
      }
    }

    return this.prisma.zaloConfig.findFirst({
      where: { branchId: null, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOtpConfig(branchId?: string | null): Promise<OtpConfig> {
    const [branchSetting, globalSetting, zaloConfig] = await Promise.all([
      branchId
        ? this.prisma.appSetting.findFirst({
            where: {
              branchId,
              group: 'auth',
              key: 'otp',
            },
          })
        : Promise.resolve(null),
      this.prisma.appSetting.findFirst({
        where: {
          branchId: null,
          group: 'auth',
          key: 'otp',
        },
      }),
      this.getActiveZaloConfig(branchId),
    ]);

    const value = {
      ...this.asObject(globalSetting?.value),
      ...this.asObject(branchSetting?.value),
    };

    const otpTemplateId =
      typeof value.otpTemplateId === 'string' ? value.otpTemplateId.trim() : '';
    const otpTemplateDataKey =
      typeof value.otpTemplateDataKey === 'string' &&
      value.otpTemplateDataKey.trim()
        ? value.otpTemplateDataKey.trim()
        : 'otp';
    const otpPhoneOverride =
      typeof value.otpPhoneOverride === 'string' &&
      value.otpPhoneOverride.trim()
        ? value.otpPhoneOverride.trim()
        : undefined;

    return {
      enabled: Boolean(value.enabled),
      channel: 'ZALO',
      apiUrl:
        typeof value.apiUrl === 'string' && value.apiUrl.trim()
          ? value.apiUrl.trim()
          : 'https://business.openapi.zalo.me/message/template',
      otpTemplateId: otpTemplateId || undefined,
      otpTemplateDataKey,
      otpPhoneOverride,
      codeLength: this.clampNumber(value.codeLength, 6, 4, 8),
      ttlMinutes: this.clampNumber(value.ttlMinutes, 5, 1, 30),
      resendCooldownSeconds: this.clampNumber(
        value.resendCooldownSeconds,
        60,
        0,
        300,
      ),
      maxRetry: this.clampNumber(value.maxRetry, 5, 1, 10),
      zaloConfig,
    };
  }

  private isOtpReady(config: OtpConfig) {
    return Boolean(config.zaloConfig?.token && config.otpTemplateId);
  }

  async getPublicOtpConfig() {
    const config = await this.getOtpConfig();
    return {
      tenantCode: this.prisma.getTenantCode(),
      enabled: config.enabled,
      configured: this.isOtpReady(config),
      channel: config.channel,
      ttlMinutes: config.ttlMinutes,
      resendCooldownSeconds: config.resendCooldownSeconds,
      codeLength: config.codeLength,
    };
  }

  async listLoginDatabases() {
    const tenants = await this.tenantCatalogService.listActiveTenants();
    return tenants.map((tenant) => ({
      code: tenant.code,
      name: tenant.name,
      databaseName: tenant.databaseName,
      databaseHost: tenant.databaseHost,
      appUrl: tenant.appUrl,
      isSystem: tenant.isSystem,
    }));
  }

  private async validateCredentials(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { username: identifier },
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sai tai khoan hoac mat khau');
    }

    const validPassword = await compare(password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Sai tai khoan hoac mat khau');
    }

    if (user.status === 'LOCKED') {
      throw new UnauthorizedException('Tai khoan da bi khoa');
    }

    return user;
  }

  private async sendOtpViaZalo(
    challengeId: string,
    phone: string,
    code: string,
    config: OtpConfig,
  ) {
    if (!config.zaloConfig?.token || !config.otpTemplateId) {
      throw new BadRequestException('OTP Zalo chua duoc cau hinh day du');
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: config.zaloConfig.token,
      },
      body: JSON.stringify({
        phone,
        template_id: config.otpTemplateId,
        template_data: {
          [config.otpTemplateDataKey]: code,
        },
        tracking_id: challengeId,
      }),
    });

    const rawText = await response.text();
    let payload: Record<string, unknown> | null = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        payload = { raw: rawText };
      }
    }

    const providerError =
      typeof payload?.error === 'number' ? payload.error : null;
    const providerMessage =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : undefined;

    if (!response.ok || (providerError !== null && providerError !== 0)) {
      throw new BadRequestException(providerMessage || 'Gui OTP Zalo that bai');
    }

    return payload || { success: true };
  }

  async requestOtp(dto: RequestOtpDto, meta?: RequestMeta) {
    const user = await this.validateCredentials(dto.identifier, dto.password);
    const config = await this.getOtpConfig(user.branchId);

    if (!config.enabled) {
      throw new BadRequestException('Dang nhap OTP hien dang tat');
    }

    if (!this.isOtpReady(config)) {
      throw new BadRequestException('OTP Zalo chua duoc cau hinh day du');
    }

    const targetPhone = this.normalizePhone(
      config.otpPhoneOverride || user.phone,
    );
    if (!targetPhone) {
      throw new BadRequestException(
        'Tai khoan chua co so dien thoai de nhan OTP Zalo',
      );
    }

    const activeChallenge = await this.prisma.loginOtpChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: 'LOGIN',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeChallenge) {
      const elapsedSeconds = Math.floor(
        (Date.now() - activeChallenge.createdAt.getTime()) / 1000,
      );
      const remainingCooldown = config.resendCooldownSeconds - elapsedSeconds;
      if (remainingCooldown > 0) {
        throw new BadRequestException(
          `Vui long doi ${remainingCooldown} giay de gui lai OTP`,
        );
      }
    }

    await this.prisma.loginOtpChallenge.updateMany({
      where: {
        userId: user.id,
        purpose: 'LOGIN',
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
        failureReason: 'REPLACED_BY_NEW_REQUEST',
      },
    });

    const code = this.generateOtpCode(config.codeLength);
    const expiresAt = new Date(Date.now() + config.ttlMinutes * 60_000);
    const challenge = await this.prisma.loginOtpChallenge.create({
      data: {
        userId: user.id,
        branchId: user.branchId,
        purpose: 'LOGIN',
        channel: config.channel,
        deliveryTarget: targetPhone,
        codeHash: await hash(code, 10),
        expiresAt,
        maxAttempts: config.maxRetry,
        requestIp: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    try {
      const providerResponse = await this.sendOtpViaZalo(
        challenge.id,
        targetPhone,
        code,
        config,
      );
      const updatedChallenge = await this.prisma.loginOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          sentAt: new Date(),
          providerResponse: this.safeJson(providerResponse),
        },
      });

      await this.auditOtp(
        AuditAction.CREATE,
        user.id,
        user.branchId,
        updatedChallenge.id,
        undefined,
        this.otpChallengeView(updatedChallenge),
      );

      return {
        challengeId: updatedChallenge.id,
        channel: config.channel,
        maskedTarget: this.maskPhone(
          config.otpPhoneOverride || user.phone || targetPhone,
        ),
        expiresAt,
        resendCooldownSeconds: config.resendCooldownSeconds,
      };
    } catch (error) {
      const failedChallenge = await this.prisma.loginOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
          failureReason:
            error instanceof Error ? error.message : 'OTP_SEND_FAILED',
        },
      });

      await this.auditOtp(
        AuditAction.UPDATE,
        user.id,
        user.branchId,
        failedChallenge.id,
        this.otpChallengeView(challenge),
        this.otpChallengeView(failedChallenge),
      );

      throw error;
    }
  }

  private async verifyLoginOtp(user: User, dto: LoginDto) {
    if (!dto.otpChallengeId || !dto.otpCode) {
      throw new UnauthorizedException(
        'Vui long gui va nhap OTP Zalo truoc khi dang nhap',
      );
    }

    const challenge = await this.prisma.loginOtpChallenge.findFirst({
      where: {
        id: dto.otpChallengeId,
        userId: user.id,
        purpose: 'LOGIN',
      },
    });

    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedException(
        'OTP da het hieu luc, vui long gui lai ma moi',
      );
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      const expiredChallenge = await this.prisma.loginOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: new Date(),
          failureReason: 'EXPIRED',
        },
      });

      await this.auditOtp(
        AuditAction.UPDATE,
        user.id,
        user.branchId,
        challenge.id,
        this.otpChallengeView(challenge),
        this.otpChallengeView(expiredChallenge),
      );

      throw new UnauthorizedException(
        'OTP da het han, vui long gui lai ma moi',
      );
    }

    const validOtp = await compare(dto.otpCode, challenge.codeHash);
    if (!validOtp) {
      const nextAttempts = challenge.attempts + 1;
      const invalidChallenge = await this.prisma.loginOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          consumedAt:
            nextAttempts >= challenge.maxAttempts ? new Date() : undefined,
          failureReason:
            nextAttempts >= challenge.maxAttempts
              ? 'MAX_ATTEMPTS_EXCEEDED'
              : 'INVALID_CODE',
        },
      });

      await this.auditOtp(
        AuditAction.UPDATE,
        user.id,
        user.branchId,
        challenge.id,
        this.otpChallengeView(challenge),
        this.otpChallengeView(invalidChallenge),
      );

      if (nextAttempts >= challenge.maxAttempts) {
        throw new UnauthorizedException(
          'OTP sai qua so lan cho phep, vui long gui lai ma moi',
        );
      }

      throw new UnauthorizedException('OTP khong hop le');
    }

    const verifiedChallenge = await this.prisma.loginOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        verifiedAt: new Date(),
        consumedAt: new Date(),
        failureReason: null,
      },
    });

    await this.auditOtp(
      AuditAction.UPDATE,
      user.id,
      user.branchId,
      challenge.id,
      this.otpChallengeView(challenge),
      this.otpChallengeView(verifiedChallenge),
    );
  }

  async login(dto: LoginDto, meta?: RequestMeta) {
    const user = await this.validateCredentials(dto.identifier, dto.password);
    const otpConfig = await this.getOtpConfig(user.branchId);

    if (otpConfig.enabled) {
      await this.verifyLoginOtp(user, dto);
    }

    const authPayload = await this.buildAuthPayload(user.id);
    const tokens = await this.signTokens(authPayload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    await this.auditLogsService.write({
      module: 'auth',
      action: AuditAction.LOGIN,
      userId: user.id,
      branchId: user.branchId,
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: {
        tenantCode: this.prisma.getTenantCode(),
        otpEnabled: otpConfig.enabled,
        otpChannel: otpConfig.enabled ? otpConfig.channel : null,
      },
    });

    return {
      user: authPayload,
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<{ sub: string }>(
      refreshToken,
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'change_this_refresh_secret',
        ),
      },
    );

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token khong hop le');
    }

    const validRefresh = await compare(refreshToken, user.refreshTokenHash);
    if (!validRefresh) {
      throw new UnauthorizedException('Refresh token khong hop le');
    }

    const authPayload = await this.buildAuthPayload(user.id);
    const tokens = await this.signTokens(authPayload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await hash(tokens.refreshToken, 10),
      },
    });

    return {
      user: authPayload,
      ...tokens,
    };
  }

  async me(user: AuthUser) {
    return this.buildAuthPayload(user.id);
  }

  async logout(user: AuthUser) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });

    await this.auditLogsService.write({
      module: 'auth',
      action: AuditAction.LOGOUT,
      userId: user.id,
      branchId: user.branchId,
      entityType: 'user',
      entityId: user.id,
    });

    return { success: true };
  }
}
