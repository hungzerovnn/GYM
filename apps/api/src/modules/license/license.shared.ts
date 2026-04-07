import { addMonths, addYears } from 'date-fns';
import { BadRequestException } from '@nestjs/common';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { LICENSE_PUBLIC_KEY } from './license.public-key';

const REQUEST_PREFIX = 'GYM-REQ';
const UNLOCK_PREFIX = 'GYM-KEY';
export const LICENSE_PRODUCT_CODE = 'FITFLOW-GYM' as const;

export const licensePlans = {
  TRIAL_1_MONTH: {
    label: '1-month trial',
    kind: 'trial',
    durationText: 'Use the system for 1 month from first activation/demo.',
  },
  SUBSCRIPTION_1_YEAR: {
    label: '1-year subscription',
    kind: 'subscription',
    durationText: 'Use the system for 1 year from activation date.',
  },
  SUBSCRIPTION_3_YEARS: {
    label: '3-year subscription',
    kind: 'subscription',
    durationText: 'Use the system for 3 years from activation date.',
  },
  PERMANENT: {
    label: 'Permanent',
    kind: 'permanent',
    durationText: 'Unlimited usage time.',
  },
} as const;

export type LicensePlanCode = keyof typeof licensePlans;

export type LicenseRequestPayload = {
  product: typeof LICENSE_PRODUCT_CODE;
  version: 1;
  requestIssuedAt: string;
  requestedPlanCode: LicensePlanCode | null;
  hostname: string;
  platform: string;
  arch: string;
  primaryMac: string | null;
  macAddresses: string[];
  machineGuid: string | null;
  machineFingerprint: string;
};

export type LicenseUnlockPayload = {
  product: typeof LICENSE_PRODUCT_CODE;
  version: 1;
  licenseId: string;
  planCode: LicensePlanCode;
  issuedAt: string;
  expiresAt: string | null;
  requestIssuedAt: string;
  hostname: string;
  primaryMac: string | null;
  macAddresses?: string[];
  machineGuid: string | null;
  machineFingerprint: string;
};

type ParsedCode<T> = {
  payload: T;
  payloadEncoded: string;
};

function toBase64Url(value: Buffer | string) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function checksum(value: string) {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactCodeText(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function findPrefixedCode(value: string, prefix: string) {
  const compact = compactCodeText(value);
  const matched = compact.match(
    new RegExp(`${escapeRegExp(prefix)}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+`),
  );
  return matched?.[0] ?? null;
}

function parsePrefixedPayload<T>(
  code: string,
  expectedPrefix: string,
): ParsedCode<T> {
  const normalizedCode =
    findPrefixedCode(code, expectedPrefix) ?? compactCodeText(code);
  const [prefix, payloadEncoded, digest] = normalizedCode.split('.');

  if (prefix !== expectedPrefix || !payloadEncoded || !digest) {
    throw new BadRequestException('License code format is invalid.');
  }

  if (checksum(payloadEncoded) !== digest) {
    throw new BadRequestException('License code checksum is invalid.');
  }

  return {
    payload: JSON.parse(fromBase64Url(payloadEncoded).toString('utf8')) as T,
    payloadEncoded,
  };
}

export function getLicensePlanLabel(planCode: LicensePlanCode) {
  return licensePlans[planCode].label;
}

export function isLicensePlanCode(value: string): value is LicensePlanCode {
  return value in licensePlans;
}

export function resolveLicenseExpiry(
  planCode: LicensePlanCode,
  issuedAt: Date,
) {
  if (planCode === 'TRIAL_1_MONTH') {
    return addMonths(issuedAt, 1);
  }

  if (planCode === 'SUBSCRIPTION_1_YEAR') {
    return addYears(issuedAt, 1);
  }

  if (planCode === 'SUBSCRIPTION_3_YEARS') {
    return addYears(issuedAt, 3);
  }

  return null;
}

export function createLicenseRequestCode(payload: LicenseRequestPayload) {
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  return `${REQUEST_PREFIX}.${payloadEncoded}.${checksum(payloadEncoded)}`;
}

export function parseLicenseRequestCode(code: string) {
  return parsePrefixedPayload<LicenseRequestPayload>(code, REQUEST_PREFIX)
    .payload;
}

export function buildUnlockPayloadFromRequest(
  request: LicenseRequestPayload,
  planCode: LicensePlanCode,
  issuedAt = new Date(),
): LicenseUnlockPayload {
  return {
    product: LICENSE_PRODUCT_CODE,
    version: 1,
    licenseId: `LIC-${createHash('sha1').update(`${request.machineFingerprint}:${issuedAt.toISOString()}:${planCode}`).digest('hex').slice(0, 12).toUpperCase()}`,
    planCode,
    issuedAt: issuedAt.toISOString(),
    expiresAt: resolveLicenseExpiry(planCode, issuedAt)?.toISOString() ?? null,
    requestIssuedAt: request.requestIssuedAt,
    hostname: request.hostname,
    primaryMac: request.primaryMac,
    macAddresses: request.macAddresses,
    machineGuid: request.machineGuid,
    machineFingerprint: request.machineFingerprint,
  };
}

export function createUnlockCode(
  payload: LicenseUnlockPayload,
  privateKeyPem: string,
) {
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(null, Buffer.from(payloadEncoded), privateKeyPem);
  return `${UNLOCK_PREFIX}.${payloadEncoded}.${toBase64Url(signature)}`;
}

export function verifyUnlockCode(unlockCode: string) {
  const normalizedUnlockCode = findPrefixedCode(unlockCode, UNLOCK_PREFIX);

  if (!normalizedUnlockCode) {
    if (findPrefixedCode(unlockCode, REQUEST_PREFIX)) {
      throw new BadRequestException(
        'You pasted a request code. Please paste the unlock code that starts with GYM-KEY.',
      );
    }

    throw new BadRequestException(
      'Unlock code format is invalid. Paste the full string that starts with GYM-KEY.',
    );
  }

  const [prefix, payloadEncoded, signatureEncoded] =
    normalizedUnlockCode.split('.');

  if (prefix !== UNLOCK_PREFIX || !payloadEncoded || !signatureEncoded) {
    throw new BadRequestException('Unlock code format is invalid.');
  }

  const isValid = verify(
    null,
    Buffer.from(payloadEncoded),
    createPublicKey(LICENSE_PUBLIC_KEY),
    fromBase64Url(signatureEncoded),
  );

  if (!isValid) {
    throw new BadRequestException('Unlock code signature is invalid.');
  }

  const payload = JSON.parse(
    fromBase64Url(payloadEncoded).toString('utf8'),
  ) as LicenseUnlockPayload;

  if (payload.product !== LICENSE_PRODUCT_CODE || payload.version !== 1) {
    throw new BadRequestException(
      'Unlock code version does not match this GYM build.',
    );
  }

  return payload;
}

export function listLicensePlans() {
  return Object.entries(licensePlans).map(([code, item]) => ({
    code: code as LicensePlanCode,
    label: item.label,
    kind: item.kind,
    durationText: item.durationText,
  }));
}
