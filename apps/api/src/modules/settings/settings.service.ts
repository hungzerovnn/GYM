import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { AuditAction, Prisma } from '@prisma/client';
import { defaultSystemProfile } from '../../common/constants/bootstrap.constants';
import { QueryDto } from '../../common/dto/query.dto';
import { AuthUser } from '../../common/types/auth-user.type';
import {
  buildListResponse,
  buildPagination,
  buildSort,
} from '../../common/utils/query.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateBirthdayTemplateDto,
  UpdateBirthdayTemplateDto,
  UpdateEmailConfigDto,
  UpdateGeneralSettingDto,
  UpdateSmsConfigDto,
  UpdateZaloConfigDto,
} from './settings.dto';

const REDACTED_VALUE = '***REDACTED***';
const execFileAsync = promisify(execFile);

const scopedJsonSettings = {
  company: {
    group: 'general',
    key: 'company_profile',
    defaults: {
      companyName: 'FitFlow Enterprise',
      legalName: '',
      taxCode: '',
      hotline: '',
      email: '',
      website: '',
      address: '',
      logoUrl: '',
      timezone: 'Asia/Bangkok',
      currency: 'VND',
      dateFormat: 'DD/MM/YYYY',
      uploadLimitMb: 10,
    },
  },
  'e-invoice': {
    group: 'billing',
    key: 'e_invoice',
    defaults: {
      provider: '',
      companyName: '',
      taxCode: '',
      serial: '',
      templateCode: '',
      invoiceEmail: '',
      notificationEmails: '',
      issuePrefix: 'INV',
      isActive: false,
      note: '',
    },
  },
  bank: {
    group: 'billing',
    key: 'bank',
    defaults: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      branchName: '',
      qrTemplate: '',
      transferContentPrefix: '',
      isActive: true,
      note: '',
    },
  },
  'code-generation': {
    group: 'general',
    key: 'code_generation',
    defaults: {
      customerPrefix: 'CUS',
      leadPrefix: 'LEAD',
      contractPrefix: 'CTR',
      receiptPrefix: 'RCP',
      expensePrefix: 'EXP',
      sessionPrefix: 'SES',
      productPrefix: 'PRD',
      padLength: 4,
      resetByBranch: false,
      note: '',
    },
  },
  'print-templates': {
    group: 'templates',
    key: 'print_templates',
    defaults: {
      printerMode: 'BROWSER_DIALOG',
      contractHeader: '',
      receiptHeader: '',
      receiptFooter: '',
      expenseHeader: '',
      expenseFooter: '',
      salesHeader: '',
      salesFooter: '',
      returnHeader: '',
      returnFooter: '',
      defaultPrinterName: '',
      printerIpAddress: '',
      printerPort: 9100,
      printerProtocol: 'RAW_9100',
      printerQueueName: '',
      printerDriverHint: '',
      paperSize: 'A4',
      paperOrientation: 'PORTRAIT',
      showLogo: true,
      showSignature: true,
      note: '',
    },
  },
  'report-templates': {
    group: 'templates',
    key: 'report_templates',
    defaults: {
      defaultTitle: 'Bao cao FitFlow',
      defaultSubtitle: '',
      reportHeader: '',
      reportFooter: '',
      showGeneratedBy: true,
      showPrintedAt: true,
      showFilters: true,
      showBranchSummary: true,
      showSignature: false,
      currencyScale: 'full',
      paperSize: 'A4',
      defaultOrientation: 'PORTRAIT',
      reportTemplates: {},
      note: '',
    },
  },
  promotions: {
    group: 'marketing',
    key: 'promotions',
    defaults: {
      programName: '',
      discountPercent: 0,
      bonusSessions: 0,
      bonusDays: 0,
      startDate: '',
      endDate: '',
      autoApply: false,
      note: '',
    },
  },
  'loyalty-points': {
    group: 'loyalty',
    key: 'points',
    defaults: {
      enabled: false,
      earnRate: 10000,
      redemptionRate: 1000,
      expiryDays: 365,
      minContractAmount: 0,
      welcomePoints: 0,
      note: '',
    },
  },
  'loyalty-benefits': {
    group: 'loyalty',
    key: 'benefits',
    defaults: {
      silverThreshold: 100,
      goldThreshold: 300,
      vipThreshold: 600,
      birthdayBonusPercent: 10,
      referralBonusPoints: 20,
      benefitNote: '',
    },
  },
  tags: {
    group: 'crm',
    key: 'tags',
    defaults: {
      enableAutoTags: true,
      leadHotTag: 'HOT',
      debtTag: 'DEBT',
      vipTag: 'VIP',
      overdueFollowUpTag: 'OVERDUE',
      note: '',
    },
  },
  'custom-fields': {
    group: 'crm',
    key: 'custom_fields',
    defaults: {
      customerFields: '',
      leadFields: '',
      contractFields: '',
      note: '',
    },
  },
  marketing: {
    group: 'marketing',
    key: 'campaign_defaults',
    defaults: {
      campaignNamePrefix: 'MKT',
      dailyQuota: 1000,
      allowBulkSend: true,
      defaultChannel: 'ZALO',
      audienceRule: '',
      note: '',
    },
  },
  rounding: {
    group: 'finance',
    key: 'rounding',
    defaults: {
      roundingMode: 'NEAREST',
      roundingUnit: 1000,
      taxRoundingMode: 'NEAREST',
      displayDecimals: 0,
      note: '',
    },
  },
  penalty: {
    group: 'operations',
    key: 'penalty',
    defaults: {
      lateCancelFee: 50000,
      noShowFee: 100000,
      ptAbsentFee: 150000,
      graceMinutes: 10,
      maxPenaltyPerDay: 3,
      note: '',
    },
  },
} as const;

type ScopedJsonSettingKey = keyof typeof scopedJsonSettings;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private asObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private normalizeBranchId(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }

  async listSystemPrinters() {
    if (platform() !== 'win32') {
      return [];
    }

    const command = [
      '$printers = Get-CimInstance Win32_Printer |',
      'Select-Object Name, PortName, DriverName, Default, WorkOffline, PrinterStatus;',
      '$printers | ConvertTo-Json -Depth 3',
    ].join(' ');

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
        { windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
      );

      const parsed = JSON.parse(stdout || '[]');
      const printers = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

      return printers.map((printer: Record<string, unknown>) => {
        const name = String(printer.Name || '').trim();
        const portName = String(printer.PortName || '').trim();
        const driverName = String(printer.DriverName || '').trim();
        const isDefault = Boolean(printer.Default);
        const isOffline = Boolean(printer.WorkOffline);
        const statusCode = Number(printer.PrinterStatus || 0);
        const statusLabel =
          statusCode === 3
            ? 'Idle'
            : statusCode === 4
              ? 'Printing'
              : statusCode === 5
                ? 'Warmup'
                : statusCode === 7
                  ? 'Offline'
                  : statusCode === 1
                    ? 'Other'
                    : 'Unknown';

        return {
          name,
          portName,
          driverName,
          isDefault,
          isOffline,
          statusCode,
          statusLabel,
          displayName: `${name}${isDefault ? ' (Default)' : ''}${portName ? ` - ${portName}` : ''}`,
        };
      });
    } catch {
      return [];
    }
  }

  async listPrinterPaperSizes(printerName: string) {
    if (platform() !== 'win32') {
      return [];
    }

    const normalizedPrinterName = String(printerName || '').trim();
    if (!normalizedPrinterName) {
      return [];
    }

    const escapedPrinterName = normalizedPrinterName.replace(/'/g, "''");
    const command = [
      'Add-Type -AssemblyName System.Drawing;',
      `$printer = '${escapedPrinterName}';`,
      '$settings = New-Object System.Drawing.Printing.PrinterSettings;',
      '$settings.PrinterName = $printer;',
      '$settings.PaperSizes | Select-Object PaperName, Kind, Width, Height | ConvertTo-Json -Depth 3',
    ].join(' ');

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
        { windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
      );

      const parsed = JSON.parse(stdout || '[]');
      const paperSizes = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      const seen = new Set<string>();

      return paperSizes
        .map((paper: Record<string, unknown>) => {
          const name = String(paper.PaperName || '').trim();
          const width = Number(paper.Width || 0);
          const height = Number(paper.Height || 0);
          const kind = Number(paper.Kind || 0);

          return {
            name,
            width,
            height,
            kind,
            displayName:
              name ||
              (width && height
                ? `${Math.round((width / 100) * 25.4)} x ${Math.round((height / 100) * 25.4)} mm`
                : ''),
          };
        })
        .filter((paper) => paper.displayName)
        .filter((paper) => {
          const dedupeKey = `${paper.name}|${paper.width}|${paper.height}`;
          if (seen.has(dedupeKey)) {
            return false;
          }
          seen.add(dedupeKey);
          return true;
        });
    } catch {
      return [];
    }
  }

  private sanitizeSensitiveData<T>(value: T): T {
    const sensitiveKeys = new Set([
      'apiKey',
      'secretKey',
      'appSecret',
      'token',
      'refreshToken',
      'password',
      'hostPassword',
    ]);

    const walk = (input: unknown): unknown => {
      if (Array.isArray(input)) {
        return input.map(walk);
      }

      if (!input || typeof input !== 'object') {
        return input;
      }

      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(
          ([key, nestedValue]) => [
            key,
            sensitiveKeys.has(key) && nestedValue
              ? REDACTED_VALUE
              : walk(nestedValue),
          ],
        ),
      );
    };

    return walk(value) as T;
  }

  private resolveSensitiveString(
    incoming: string | undefined,
    current?: string | null,
  ) {
    if (incoming === undefined) {
      return current ?? undefined;
    }

    return incoming === REDACTED_VALUE ? (current ?? undefined) : incoming;
  }

  private sanitizeChannelPayload<T extends Record<string, unknown> | null>(
    payload: T,
    branchName?: string,
    settingId?: string | null,
    createdAt?: Date | null,
    updatedAt?: Date | null,
  ) {
    if (!payload) {
      return payload;
    }

    return {
      ...(this.sanitizeSensitiveData(payload) as Record<string, unknown>),
      branchName: branchName || '',
      settingId: settingId || null,
      createdAt: createdAt || null,
      updatedAt: updatedAt || null,
    };
  }

  private getScopedSettingDefinition(settingKey: string) {
    const definition = scopedJsonSettings[settingKey as ScopedJsonSettingKey];
    if (!definition) {
      throw new NotFoundException('Setting not found');
    }

    return definition;
  }

  private async audit(
    user: AuthUser,
    entityType: string,
    entityId: string,
    beforeData?: unknown,
    afterData?: unknown,
  ) {
    await this.auditLogsService.write({
      module: 'settings',
      action: AuditAction.UPDATE,
      userId: user.id,
      branchId: user.branchId,
      entityType,
      entityId,
      beforeData: beforeData
        ? this.sanitizeSensitiveData(beforeData)
        : undefined,
      afterData: afterData ? this.sanitizeSensitiveData(afterData) : undefined,
    });
  }

  private async upsertJsonSetting(
    branchId: string | null | undefined,
    group: string,
    key: string,
    value: Prisma.InputJsonValue,
  ) {
    const existing = await this.prisma.appSetting.findFirst({
      where: {
        branchId: branchId ?? null,
        group,
        key,
      },
    });

    if (existing) {
      return this.prisma.appSetting.update({
        where: { id: existing.id },
        data: { value },
      });
    }

    return this.prisma.appSetting.create({
      data: {
        branchId: branchId ?? null,
        group,
        key,
        value,
      },
    });
  }

  private async getJsonSettingRecord(
    branchId: string | undefined,
    group: string,
    key: string,
  ) {
    return this.prisma.appSetting.findFirst({
      where: {
        branchId: branchId ?? null,
        group,
        key,
      },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });
  }

  private async getJsonSetting(
    branchId: string | undefined,
    group: string,
    key: string,
    defaults: Record<string, unknown> = {},
  ) {
    const setting = await this.getJsonSettingRecord(branchId, group, key);

    return {
      ...defaults,
      ...this.asObject(setting?.value),
      branchId: setting?.branchId || branchId || null,
      branchName: setting?.branch?.name || '',
      settingId: setting?.id || null,
      createdAt: setting?.createdAt || null,
      updatedAt: setting?.updatedAt || null,
    };
  }

  async getScopedJsonSetting(settingKey: string, branchId?: string) {
    const definition = this.getScopedSettingDefinition(settingKey);
    return this.getJsonSetting(
      this.normalizeBranchId(branchId),
      definition.group,
      definition.key,
      definition.defaults,
    );
  }

  async updateScopedJsonSetting(
    settingKey: string,
    dto: Record<string, unknown>,
    user: AuthUser,
  ) {
    const definition = this.getScopedSettingDefinition(settingKey);
    const branchId = this.normalizeBranchId(dto.branchId);
    const { branchId: _branchId, ...value } = dto;
    const before = await this.getJsonSetting(
      branchId,
      definition.group,
      definition.key,
      definition.defaults,
    );
    const payload = await this.upsertJsonSetting(
      branchId,
      definition.group,
      definition.key,
      value as Prisma.InputJsonValue,
    );
    const after = await this.getJsonSetting(
      branchId,
      definition.group,
      definition.key,
      definition.defaults,
    );
    await this.audit(
      user,
      `setting_${settingKey.replaceAll('-', '_')}`,
      payload.id,
      before,
      after,
    );
    return after;
  }

  private async getOtpSetting(branchId?: string) {
    const [branchSetting, globalSetting] = await Promise.all([
      branchId
        ? this.prisma.appSetting.findFirst({
            where: { branchId, group: 'auth', key: 'otp' },
          })
        : Promise.resolve(null),
      this.prisma.appSetting.findFirst({
        where: { branchId: null, group: 'auth', key: 'otp' },
      }),
    ]);

    const raw = {
      ...this.asObject(globalSetting?.value),
      ...this.asObject(branchSetting?.value),
    };

    return {
      enabled: Boolean(raw.enabled),
      apiUrl:
        typeof raw.apiUrl === 'string' && raw.apiUrl.trim()
          ? raw.apiUrl.trim()
          : 'https://business.openapi.zalo.me/message/template',
      otpTemplateId:
        typeof raw.otpTemplateId === 'string' ? raw.otpTemplateId : '',
      otpTemplateDataKey:
        typeof raw.otpTemplateDataKey === 'string' &&
        raw.otpTemplateDataKey.trim()
          ? raw.otpTemplateDataKey.trim()
          : 'otp',
      otpPhoneOverride:
        typeof raw.otpPhoneOverride === 'string' ? raw.otpPhoneOverride : '',
      otpCodeLength: typeof raw.codeLength === 'number' ? raw.codeLength : 6,
      otpTtlMinutes: typeof raw.ttlMinutes === 'number' ? raw.ttlMinutes : 5,
      otpResendCooldownSeconds:
        typeof raw.resendCooldownSeconds === 'number'
          ? raw.resendCooldownSeconds
          : 60,
      otpMaxRetry: typeof raw.maxRetry === 'number' ? raw.maxRetry : 5,
      settingId: branchSetting?.id || globalSetting?.id || null,
    };
  }

  async getSmsConfig(branchId?: string) {
    const payload = await this.prisma.smsConfig.findFirst({
      where: branchId ? { branchId } : { branchId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    return payload
      ? this.sanitizeChannelPayload(
          payload,
          payload.branch?.name,
          payload.id,
          payload.createdAt,
          payload.updatedAt,
        )
      : {
          branchId: branchId || null,
          branchName: '',
          settingId: null,
          createdAt: null,
          updatedAt: null,
        };
  }

  async updateSmsConfig(dto: UpdateSmsConfigDto, user: AuthUser) {
    const existing = await this.prisma.smsConfig.findFirst({
      where: dto.branchId ? { branchId: dto.branchId } : { branchId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });
    const before = this.sanitizeChannelPayload(
      existing,
      existing?.branch?.name,
      existing?.id,
      existing?.createdAt,
      existing?.updatedAt,
    );
    const payload = existing
      ? await this.prisma.smsConfig.update({
          where: { id: existing.id },
          data: {
            ...dto,
            apiKey: this.resolveSensitiveString(dto.apiKey, existing.apiKey),
            secretKey: this.resolveSensitiveString(
              dto.secretKey,
              existing.secretKey,
            ),
          },
          include: {
            branch: {
              select: { name: true },
            },
          },
        })
      : await this.prisma.smsConfig.create({
          data: dto,
          include: {
            branch: {
              select: { name: true },
            },
          },
        });

    const after = this.sanitizeChannelPayload(
      payload,
      payload.branch?.name,
      payload.id,
      payload.createdAt,
      payload.updatedAt,
    );
    await this.audit(user, 'sms_config', payload.id, before, after);
    return after;
  }

  async getEmailConfig(branchId?: string) {
    const payload = await this.prisma.emailConfig.findFirst({
      where: branchId ? { branchId } : { branchId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });

    return payload
      ? this.sanitizeChannelPayload(
          payload,
          payload.branch?.name,
          payload.id,
          payload.createdAt,
          payload.updatedAt,
        )
      : {
          branchId: branchId || null,
          branchName: '',
          settingId: null,
          createdAt: null,
          updatedAt: null,
        };
  }

  async updateEmailConfig(dto: UpdateEmailConfigDto, user: AuthUser) {
    const existing = await this.prisma.emailConfig.findFirst({
      where: dto.branchId ? { branchId: dto.branchId } : { branchId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { name: true },
        },
      },
    });
    const before = this.sanitizeChannelPayload(
      existing,
      existing?.branch?.name,
      existing?.id,
      existing?.createdAt,
      existing?.updatedAt,
    );
    const payload = existing
      ? await this.prisma.emailConfig.update({
          where: { id: existing.id },
          data: {
            ...dto,
            password: this.resolveSensitiveString(
              dto.password,
              existing.password,
            ),
          },
          include: {
            branch: {
              select: { name: true },
            },
          },
        })
      : await this.prisma.emailConfig.create({
          data: dto,
          include: {
            branch: {
              select: { name: true },
            },
          },
        });

    const after = this.sanitizeChannelPayload(
      payload,
      payload.branch?.name,
      payload.id,
      payload.createdAt,
      payload.updatedAt,
    );
    await this.audit(user, 'email_config', payload.id, before, after);
    return after;
  }

  async getZaloConfig(branchId?: string) {
    const [zaloConfig, otpSetting] = await Promise.all([
      this.prisma.zaloConfig.findFirst({
        where: branchId ? { branchId } : { branchId: null },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: { name: true },
          },
        },
      }),
      this.getOtpSetting(branchId),
    ]);

    return this.sanitizeChannelPayload(
      {
        ...(zaloConfig || {}),
        branchId: zaloConfig?.branchId || branchId || null,
        apiUrl: otpSetting.apiUrl,
        otpEnabled: otpSetting.enabled,
        otpTemplateId: otpSetting.otpTemplateId,
        otpTemplateDataKey: otpSetting.otpTemplateDataKey,
        otpPhoneOverride: otpSetting.otpPhoneOverride,
        otpCodeLength: otpSetting.otpCodeLength,
        otpTtlMinutes: otpSetting.otpTtlMinutes,
        otpResendCooldownSeconds: otpSetting.otpResendCooldownSeconds,
        otpMaxRetry: otpSetting.otpMaxRetry,
      },
      zaloConfig?.branch?.name,
      zaloConfig?.id || otpSetting.settingId,
      zaloConfig?.createdAt || null,
      zaloConfig?.updatedAt || null,
    );
  }

  async updateZaloConfig(dto: UpdateZaloConfigDto, user: AuthUser) {
    const before = await this.getZaloConfig(dto.branchId);
    const currentOtpSetting = await this.getOtpSetting(dto.branchId);

    const existingConfig = await this.prisma.zaloConfig.findFirst({
      where: dto.branchId ? { branchId: dto.branchId } : { branchId: null },
      orderBy: { createdAt: 'desc' },
    });

    const otpSettingPayload = {
      enabled: dto.otpEnabled ?? currentOtpSetting.enabled,
      apiUrl: dto.apiUrl ?? currentOtpSetting.apiUrl,
      otpTemplateId: dto.otpTemplateId ?? currentOtpSetting.otpTemplateId,
      otpTemplateDataKey:
        dto.otpTemplateDataKey ?? currentOtpSetting.otpTemplateDataKey,
      otpPhoneOverride:
        dto.otpPhoneOverride ?? currentOtpSetting.otpPhoneOverride,
      codeLength: dto.otpCodeLength ?? currentOtpSetting.otpCodeLength,
      ttlMinutes: dto.otpTtlMinutes ?? currentOtpSetting.otpTtlMinutes,
      resendCooldownSeconds:
        dto.otpResendCooldownSeconds ??
        currentOtpSetting.otpResendCooldownSeconds,
      maxRetry: dto.otpMaxRetry ?? currentOtpSetting.otpMaxRetry,
    };

    const zaloPayload = {
      branchId: dto.branchId,
      oaName: dto.oaName,
      oaId: dto.oaId,
      appId: dto.appId,
      appSecret: this.resolveSensitiveString(
        dto.appSecret,
        existingConfig?.appSecret,
      ),
      token: this.resolveSensitiveString(dto.token, existingConfig?.token),
      refreshToken: this.resolveSensitiveString(
        dto.refreshToken,
        existingConfig?.refreshToken,
      ),
      maxPerDay: dto.maxPerDay,
      templateBirthday: dto.templateBirthday,
      templateReminder: dto.templateReminder,
      isActive: dto.isActive,
    };

    const effectiveToken = zaloPayload.token ?? null;
    const effectiveIsActive = dto.isActive ?? existingConfig?.isActive ?? true;

    if (
      otpSettingPayload.enabled &&
      (!effectiveIsActive ||
        !effectiveToken ||
        !otpSettingPayload.otpTemplateId.trim())
    ) {
      throw new BadRequestException(
        'Can cau hinh token Zalo, OTP template ID va bat kenh Zalo truoc khi kich hoat OTP',
      );
    }

    const zaloConfig = existingConfig
      ? await this.prisma.zaloConfig.update({
          where: { id: existingConfig.id },
          data: zaloPayload,
        })
      : await this.prisma.zaloConfig.create({
          data: zaloPayload,
        });

    const otpSetting = await this.upsertJsonSetting(
      dto.branchId,
      'auth',
      'otp',
      {
        enabled: otpSettingPayload.enabled,
        channel: 'ZALO',
        apiUrl: otpSettingPayload.apiUrl,
        otpTemplateId: otpSettingPayload.otpTemplateId,
        otpTemplateDataKey: otpSettingPayload.otpTemplateDataKey,
        otpPhoneOverride: otpSettingPayload.otpPhoneOverride,
        codeLength: otpSettingPayload.codeLength,
        ttlMinutes: otpSettingPayload.ttlMinutes,
        resendCooldownSeconds: otpSettingPayload.resendCooldownSeconds,
        maxRetry: otpSettingPayload.maxRetry,
      },
    );

    const payload = await this.getZaloConfig(dto.branchId);
    await this.audit(
      user,
      'zalo_config',
      zaloConfig.id || otpSetting.id,
      before,
      payload,
    );
    return payload;
  }

  async listBirthdayTemplates(query: QueryDto) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { title: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.birthdayTemplate.findMany({
        where,
        include: {
          branch: {
            select: { name: true },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.birthdayTemplate.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => ({
        ...item,
        branchName: item.branch?.name || '',
      })),
      total,
      query,
    );
  }

  async createBirthdayTemplate(dto: CreateBirthdayTemplateDto, user: AuthUser) {
    const payload = await this.prisma.birthdayTemplate.create({
      data: dto,
      include: {
        branch: {
          select: { name: true },
        },
      },
    });
    const after = { ...payload, branchName: payload.branch?.name || '' };
    await this.audit(user, 'birthday_template', payload.id, undefined, after);
    return after;
  }

  async updateBirthdayTemplate(
    id: string,
    dto: UpdateBirthdayTemplateDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.birthdayTemplate.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Birthday template not found');
    const payload = await this.prisma.birthdayTemplate.update({
      where: { id },
      data: dto,
      include: {
        branch: {
          select: { name: true },
        },
      },
    });
    const after = { ...payload, branchName: payload.branch?.name || '' };
    await this.audit(user, 'birthday_template', id, before, after);
    return after;
  }

  async getGeneralSetting() {
    const setting = await this.prisma.appSetting.findFirst({
      where: {
        group: 'general',
        key: 'system_profile',
      },
    });

    return {
      ...defaultSystemProfile,
      ...this.asObject(setting?.value),
      settingId: setting?.id || null,
      createdAt: setting?.createdAt || null,
      updatedAt: setting?.updatedAt || null,
    };
  }

  async updateGeneralSetting(dto: UpdateGeneralSettingDto, user: AuthUser) {
    const before = await this.getGeneralSetting();
    const existing = await this.prisma.appSetting.findFirst({
      where: { group: 'general', key: 'system_profile' },
    });
    const payload = existing
      ? await this.prisma.appSetting.update({
          where: { id: existing.id },
          data: { value: dto as never },
        })
      : await this.prisma.appSetting.create({
          data: {
            group: 'general',
            key: 'system_profile',
            value: dto as never,
          },
        });

    const after = {
      ...this.asObject(payload.value),
      settingId: payload.id,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
    await this.audit(user, 'general_setting', payload.id, before, after);
    return after;
  }
}
