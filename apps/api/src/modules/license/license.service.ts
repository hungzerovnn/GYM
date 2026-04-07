import { execFile } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  addMonths,
  differenceInCalendarDays,
  isAfter,
  parseISO,
} from 'date-fns';
import {
  createLicenseRequestCode,
  getLicensePlanLabel,
  isLicensePlanCode,
  type LicensePlanCode,
  type LicenseRequestPayload,
  type LicenseUnlockPayload,
  verifyUnlockCode,
} from './license.shared';

const execFileAsync = promisify(execFile);

type StoredLicenseState = {
  version: 1;
  installedAt: string;
  activeLicense: {
    unlockCode: string;
    activatedAt: string;
    payload: LicenseUnlockPayload;
  } | null;
};

export type MachineIdentity = {
  hostname: string;
  platform: string;
  arch: string;
  primaryMac: string | null;
  macAddresses: string[];
  machineGuid: string | null;
  machineFingerprint: string;
};

export type LicenseStatusSummary = {
  state: 'active' | 'warning' | 'expired' | 'invalid';
  usable: boolean;
  source: 'trial' | 'license';
  planCode: LicensePlanCode;
  planLabel: string;
  isPermanent: boolean;
  expiresAt: string | null;
  issuedAt: string;
  daysRemaining: number | null;
  machine: {
    hostname: string;
    primaryMac: string | null;
    machineGuid: string | null;
    machineFingerprint: string;
  };
  requestPlanCode: LicensePlanCode;
  requestCode: string;
  unlockCodePresent: boolean;
  detailMessage: string;
  warningMessage: string | null;
  licenseId: string | null;
};

export type LicenseMachineMatchReason =
  | 'machine_guid_changed'
  | 'licensed_mac_missing'
  | 'fingerprint_changed';

type LicenseMachineMatchResult = {
  matches: boolean;
  reason: LicenseMachineMatchReason | null;
};

let cachedMachineIdentity: Promise<MachineIdentity> | null = null;

function resolveProjectRoot() {
  const cwd = process.cwd();
  const parent = path.basename(path.dirname(cwd)).toLowerCase();
  const current = path.basename(cwd).toLowerCase();

  if (parent === 'apps' && current === 'api') {
    return path.resolve(cwd, '..', '..');
  }

  return cwd;
}

const LICENSE_STATE_DIR = path.resolve(resolveProjectRoot(), 'data', 'license');
const LICENSE_STATE_FILE = path.join(LICENSE_STATE_DIR, 'license-state.json');

function normalizeMacAddress(value: string) {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function normalizeMachineGuid(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function normalizeMacAddressList(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => (value ? normalizeMacAddress(value) : ''))
        .filter(Boolean),
    ),
  ].sort();
}

function getLicensedMacAddresses(payload: LicenseUnlockPayload) {
  if (payload.macAddresses?.length) {
    return normalizeMacAddressList(payload.macAddresses);
  }

  return normalizeMacAddressList([payload.primaryMac]);
}

function getLicenseMismatchCopy(reason: LicenseMachineMatchReason) {
  if (reason === 'machine_guid_changed') {
    return {
      detailMessage:
        'This license no longer matches the current Windows installation or machine. This usually happens after reinstalling Windows or moving the disk to another computer.',
      warningMessage:
        'Deleting data, backups, or routine cleanup does not remove the license. A new key is only needed after Windows reinstall, hardware move, or machine replacement.',
    };
  }

  if (reason === 'licensed_mac_missing') {
    return {
      detailMessage:
        'The licensed network adapter cannot be found on this machine anymore. This usually happens after changing NIC hardware or moving the disk to another computer.',
      warningMessage:
        'Deleting data, backups, or routine cleanup does not remove the license. A new key is only needed after NIC replacement, Windows reinstall, or machine move.',
    };
  }

  return {
    detailMessage:
      'Machine identity changed outside the allowed range. This usually happens after changing NIC hardware, reinstalling Windows, or moving the disk to another machine.',
    warningMessage:
      'Deleting data, backups, or routine cleanup does not remove the license. A new key is only needed after major hardware or Windows changes.',
  };
}

export function validateLicensedMachine(
  payload: LicenseUnlockPayload,
  machine: MachineIdentity,
): LicenseMachineMatchResult {
  const licensedMachineGuid = normalizeMachineGuid(payload.machineGuid);
  const currentMachineGuid = normalizeMachineGuid(machine.machineGuid);

  if (
    licensedMachineGuid &&
    currentMachineGuid &&
    licensedMachineGuid !== currentMachineGuid
  ) {
    return { matches: false, reason: 'machine_guid_changed' };
  }

  const licensedMacAddresses = getLicensedMacAddresses(payload);
  const currentMacAddresses = normalizeMacAddressList(machine.macAddresses);

  if (licensedMacAddresses.length > 0 && currentMacAddresses.length > 0) {
    const currentMacSet = new Set(currentMacAddresses);

    if (
      !licensedMacAddresses.some((macAddress) => currentMacSet.has(macAddress))
    ) {
      return { matches: false, reason: 'licensed_mac_missing' };
    }

    return { matches: true, reason: null };
  }

  if (licensedMachineGuid && currentMachineGuid) {
    return { matches: true, reason: null };
  }

  if (payload.machineFingerprint !== machine.machineFingerprint) {
    return { matches: false, reason: 'fingerprint_changed' };
  }

  return { matches: true, reason: null };
}

async function readWindowsMachineGuid() {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const { stdout } = await execFileAsync('reg', [
      'query',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography',
      '/v',
      'MachineGuid',
    ]);
    const matched = stdout.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    return matched?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function readMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = Object.values(interfaces)
    .flatMap((items) => items ?? [])
    .filter(
      (item) =>
        item && !item.internal && item.mac && item.mac !== '00:00:00:00:00:00',
    )
    .map((item) => normalizeMacAddress(item.mac))
    .filter(Boolean);

  return [...new Set(macs)].sort();
}

async function getMachineIdentity(): Promise<MachineIdentity> {
  cachedMachineIdentity ??= (async () => {
    const machineGuid = await readWindowsMachineGuid();
    const macAddresses = readMacAddresses();
    const hostname = os.hostname();
    const platform = process.platform;
    const arch = process.arch;
    const primaryMac = macAddresses[0] ?? null;
    const machineFingerprint = createHash('sha256')
      .update(
        [
          hostname,
          platform,
          arch,
          machineGuid ?? '-',
          macAddresses.join(',') || '-',
        ].join('|'),
      )
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();

    return {
      hostname,
      platform,
      arch,
      primaryMac,
      macAddresses,
      machineGuid,
      machineFingerprint,
    };
  })();

  return cachedMachineIdentity;
}

function createDefaultState(): StoredLicenseState {
  return {
    version: 1,
    installedAt: new Date().toISOString(),
    activeLicense: null,
  };
}

function buildRequestPayload(
  machine: MachineIdentity,
  requestedPlanCode: LicensePlanCode,
): LicenseRequestPayload {
  return {
    product: 'FITFLOW-GYM',
    version: 1,
    requestIssuedAt: new Date().toISOString(),
    requestedPlanCode,
    hostname: machine.hostname,
    platform: machine.platform,
    arch: machine.arch,
    primaryMac: machine.primaryMac,
    macAddresses: machine.macAddresses,
    machineGuid: machine.machineGuid,
    machineFingerprint: machine.machineFingerprint,
  };
}

function summarizeStatus(input: {
  source: 'trial' | 'license';
  planCode: LicensePlanCode;
  issuedAt: string;
  expiresAt: string | null;
  machine: MachineIdentity;
  requestPlanCode: LicensePlanCode;
  requestCode: string;
  unlockCodePresent: boolean;
  detailMessage: string;
  warningMessage: string | null;
  licenseId: string | null;
  overrideState?: 'active' | 'warning' | 'expired' | 'invalid';
  overrideUsable?: boolean;
}) {
  const expiresAtDate = input.expiresAt ? parseISO(input.expiresAt) : null;
  const daysRemaining = expiresAtDate
    ? differenceInCalendarDays(expiresAtDate, new Date())
    : null;
  const isExpired = expiresAtDate ? !isAfter(expiresAtDate, new Date()) : false;
  const isWarning = !isExpired && daysRemaining !== null && daysRemaining <= 7;
  const state =
    input.overrideState ??
    (isExpired ? 'expired' : isWarning ? 'warning' : 'active');
  const usable =
    input.overrideUsable ?? (state === 'active' || state === 'warning');

  return {
    state,
    usable,
    source: input.source,
    planCode: input.planCode,
    planLabel: getLicensePlanLabel(input.planCode),
    isPermanent: input.expiresAt === null,
    expiresAt: input.expiresAt,
    issuedAt: input.issuedAt,
    daysRemaining,
    machine: {
      hostname: input.machine.hostname,
      primaryMac: input.machine.primaryMac,
      machineGuid: input.machine.machineGuid,
      machineFingerprint: input.machine.machineFingerprint,
    },
    requestPlanCode: input.requestPlanCode,
    requestCode: input.requestCode,
    unlockCodePresent: input.unlockCodePresent,
    detailMessage: input.detailMessage,
    warningMessage: input.warningMessage,
    licenseId: input.licenseId,
  } satisfies LicenseStatusSummary;
}

function resolveRequestedPlanCode(
  requestedPlanCode: LicensePlanCode | undefined,
  state: StoredLicenseState,
): LicensePlanCode {
  if (requestedPlanCode) {
    return requestedPlanCode;
  }

  return state.activeLicense?.payload.planCode ?? 'TRIAL_1_MONTH';
}

function buildTrialStatus(
  state: StoredLicenseState,
  machine: MachineIdentity,
  requestPlanCode: LicensePlanCode,
  requestCode: string,
  overrides?: {
    issuedAt?: string;
    expiresAt?: string | null;
    detailMessage?: string;
    warningMessage?: string | null;
    unlockCodePresent?: boolean;
  },
) {
  const installedAt = parseISO(state.installedAt);
  const issuedAt = overrides?.issuedAt ?? installedAt.toISOString();
  const expiresAt =
    overrides?.expiresAt ?? addMonths(installedAt, 1).toISOString();
  const daysRemaining = expiresAt
    ? differenceInCalendarDays(parseISO(expiresAt), new Date())
    : null;

  return summarizeStatus({
    source: 'trial',
    planCode: 'TRIAL_1_MONTH',
    issuedAt,
    expiresAt,
    machine,
    requestPlanCode,
    requestCode,
    unlockCodePresent: overrides?.unlockCodePresent ?? false,
    detailMessage:
      overrides?.detailMessage ??
      'The system is running in 1-month trial mode from the first startup date.',
    warningMessage:
      overrides?.warningMessage ??
      (daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0
        ? `${daysRemaining} day(s) left in trial mode. Generate a new key before it expires.`
        : null),
    licenseId: null,
  });
}

@Injectable()
export class LicenseService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private getActivationPassword() {
    return (
      this.configService.get<string>('LICENSE_ACTIVATION_PASSWORD')?.trim() ||
      '258258'
    );
  }

  private getActivationSecret() {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'change_this_access_secret';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'change_this_refresh_secret';
    return `${accessSecret}:${refreshSecret}:license-access`;
  }

  private safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private async ensureStateFile() {
    await mkdir(LICENSE_STATE_DIR, { recursive: true });

    try {
      const raw = await readFile(LICENSE_STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredLicenseState>;

      return {
        version: 1,
        installedAt: parsed.installedAt ?? new Date().toISOString(),
        activeLicense: parsed.activeLicense ?? null,
      } satisfies StoredLicenseState;
    } catch {
      const initial = createDefaultState();
      await writeFile(
        LICENSE_STATE_FILE,
        JSON.stringify(initial, null, 2),
        'utf8',
      );
      return initial;
    }
  }

  private async writeStateFile(state: StoredLicenseState) {
    await mkdir(LICENSE_STATE_DIR, { recursive: true });
    await writeFile(LICENSE_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  }

  parseRequestedPlanCode(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    return isLicensePlanCode(normalized) ? normalized : undefined;
  }

  async getStatus(requestedPlanCode?: LicensePlanCode) {
    const [state, machine] = await Promise.all([
      this.ensureStateFile(),
      getMachineIdentity(),
    ]);
    const effectiveRequestPlanCode = resolveRequestedPlanCode(
      requestedPlanCode,
      state,
    );
    const requestCode = createLicenseRequestCode(
      buildRequestPayload(machine, effectiveRequestPlanCode),
    );

    if (!state.activeLicense) {
      return buildTrialStatus(
        state,
        machine,
        effectiveRequestPlanCode,
        requestCode,
      );
    }

    const payload = state.activeLicense.payload;
    const machineMatch = validateLicensedMachine(payload, machine);

    if (!machineMatch.matches) {
      const mismatchCopy = getLicenseMismatchCopy(
        machineMatch.reason ?? 'fingerprint_changed',
      );

      return summarizeStatus({
        source: 'license',
        planCode: payload.planCode,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        machine,
        requestPlanCode: effectiveRequestPlanCode,
        requestCode,
        unlockCodePresent: true,
        detailMessage: mismatchCopy.detailMessage,
        warningMessage: mismatchCopy.warningMessage,
        licenseId: payload.licenseId,
        overrideState: 'invalid',
        overrideUsable: false,
      });
    }

    const daysRemaining = payload.expiresAt
      ? differenceInCalendarDays(parseISO(payload.expiresAt), new Date())
      : null;

    return summarizeStatus({
      source: 'license',
      planCode: payload.planCode,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      machine,
      requestPlanCode: effectiveRequestPlanCode,
      requestCode,
      unlockCodePresent: true,
      detailMessage:
        payload.expiresAt === null
          ? 'Permanent license is active on this machine.'
          : 'License key is valid on this machine.',
      warningMessage:
        daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0
          ? `${daysRemaining} day(s) left on the license. Renew before the system gets locked.`
          : null,
      licenseId: payload.licenseId,
    });
  }

  async activate(unlockCode: string) {
    const trimmed = unlockCode.trim();

    if (!trimmed) {
      throw new BadRequestException('Please enter an unlock code.');
    }

    const payload = verifyUnlockCode(trimmed);
    const [state, machine] = await Promise.all([
      this.ensureStateFile(),
      getMachineIdentity(),
    ]);
    const machineMatch = validateLicensedMachine(payload, machine);

    if (!machineMatch.matches) {
      throw new BadRequestException(
        'This unlock code was not issued for the current machine. A new key is only needed after Windows reinstall, NIC replacement, or moving the disk to another computer.',
      );
    }

    const nextState: StoredLicenseState = {
      ...state,
      activeLicense: {
        unlockCode: trimmed,
        activatedAt: new Date().toISOString(),
        payload,
      },
    };

    await this.writeStateFile(nextState);
    return this.getStatus();
  }

  async assertUsable() {
    const status = await this.getStatus();

    if (status.usable) {
      return status;
    }

    const code =
      status.state === 'expired' ? 'LICENSE_EXPIRED' : 'LICENSE_INVALID';
    const message =
      status.state === 'expired'
        ? 'Trial or license has expired. Activate a new key to continue using the system.'
        : 'The current license key is not valid on this machine. Data cleanup does not remove a license; a new key is only needed after major Windows or hardware changes.';

    throw new ForbiddenException({
      code,
      message,
      license: status,
    });
  }

  assertActivationPassword(password: string) {
    if (!this.safeCompare(password.trim(), this.getActivationPassword())) {
      throw new UnauthorizedException('License password is incorrect.');
    }
  }

  async createActivationAccessToken() {
    return this.jwtService.signAsync(
      {
        scope: 'license-activation',
      },
      {
        secret: this.getActivationSecret(),
        expiresIn: '15m',
      },
    );
  }

  async assertActivationAccessToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ scope?: string }>(
        token,
        {
          secret: this.getActivationSecret(),
        },
      );

      if (payload.scope !== 'license-activation') {
        throw new ForbiddenException('License activation session is invalid.');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException(
        'License activation session expired. Enter the license password again.',
      );
    }
  }
}
