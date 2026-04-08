export type AttendanceDeviceVendor =
  | 'GENERIC'
  | 'ZKTECO'
  | 'HIKVISION'
  | 'SUPREMA'
  | 'ANVIZ'
  | 'RONALD_JACK';

export type AttendanceDeviceMachineType =
  | 'FINGERPRINT'
  | 'FACE'
  | 'CARD'
  | 'HYBRID';

export type AttendanceDeviceProtocol =
  | 'GENERIC_EXPORT'
  | 'CSV_IMPORT'
  | 'ZK_PULL_TCP'
  | 'ZK_ADMS_PUSH'
  | 'HIKVISION_ISAPI'
  | 'SUPREMA_BIOSTAR'
  | 'GENERIC_HTTP';

export type AttendanceDevicePersonType = 'STAFF' | 'CUSTOMER';

export type AttendanceDeviceEnrollmentType = 'FACE' | 'CARD' | 'FINGERPRINT';

export interface AttendanceDeviceMachineRuntime {
  id: string;
  code: string;
  name: string;
  branchId: string;
  vendor: AttendanceDeviceVendor | string;
  machineType: AttendanceDeviceMachineType | string;
  protocol: AttendanceDeviceProtocol | string;
  model?: string | null;
  deviceIdentifier?: string | null;
  host?: string | null;
  connectionPort?: string | null;
  username?: string | null;
  password?: string | null;
  apiKey?: string | null;
  commKey?: string | null;
  webhookSecret?: string | null;
  timeZone?: string | null;
  pollingIntervalSeconds?: number | null;
  apiKeyConfigured?: boolean;
  passwordConfigured?: boolean;
  webhookConfigured?: boolean;
  supportsFaceImage?: boolean;
  supportsFaceTemplate?: boolean;
  supportsCardEnrollment?: boolean;
  supportsFingerprintTemplate?: boolean;
  supportsWebhook?: boolean;
  lastHeartbeatAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastLogCursor?: string | null;
  lastUserSyncCursor?: string | null;
}

export interface AttendanceDeviceCapability {
  key: string;
  label: string;
  supported: boolean;
  notes?: string;
}

export interface AttendanceDeviceConnectorActionResult {
  connectorKey: string;
  supported: boolean;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AttendanceDeviceUserPayload {
  personType: AttendanceDevicePersonType;
  personId: string;
  displayName: string;
  appAttendanceCode?: string;
  machineUserId?: string;
  machineCode?: string;
  cardCode?: string;
  metadata?: Record<string, unknown>;
}

export interface AttendanceDeviceAttendanceLogPayload {
  externalEventId?: string;
  machineUserId?: string;
  appAttendanceCode?: string;
  rawCode?: string;
  eventAt: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT';
  verificationMethod: 'FINGERPRINT' | 'FACE' | 'CARD' | 'MOBILE' | 'MANUAL';
  payload?: Record<string, unknown>;
}

export interface AttendanceDeviceLogRangePayload {
  dateFrom: string;
  dateTo: string;
  startAt: string;
  endAt: string;
}

export interface AttendanceDeviceConnector {
  readonly key: string;
  readonly displayName: string;
  readonly vendor: AttendanceDeviceVendor | 'GENERIC';
  supports(machine: AttendanceDeviceMachineRuntime): boolean;
  getCapabilities(
    machine: AttendanceDeviceMachineRuntime,
  ): AttendanceDeviceCapability[];
  ping(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceConnectorActionResult>;
  syncTime(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceConnectorActionResult>;
  pullAttendanceLogs(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceAttendanceLogPayload[]>;
  pullAllAttendanceLogs?(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceAttendanceLogPayload[]>;
  pullAttendanceLogsByRange?(
    machine: AttendanceDeviceMachineRuntime,
    range: AttendanceDeviceLogRangePayload,
  ): Promise<AttendanceDeviceAttendanceLogPayload[]>;
  pullUsers(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceUserPayload[]>;
  pushUsers(
    machine: AttendanceDeviceMachineRuntime,
    users: AttendanceDeviceUserPayload[],
  ): Promise<AttendanceDeviceConnectorActionResult>;
  createEnrollment(
    machine: AttendanceDeviceMachineRuntime,
    payload: {
      personType: AttendanceDevicePersonType;
      personId: string;
      enrollmentType: AttendanceDeviceEnrollmentType;
      displayName?: string;
      appAttendanceCode?: string;
      machineCode?: string;
      machineUserId?: string;
      cardCode?: string;
      faceImageUrl?: string;
      faceImageBase64?: string;
    },
  ): Promise<AttendanceDeviceConnectorActionResult>;
  deleteAttendanceLogsByRange?(
    machine: AttendanceDeviceMachineRuntime,
    range: AttendanceDeviceLogRangePayload,
  ): Promise<AttendanceDeviceConnectorActionResult>;
  deleteAllAttendanceLogs?(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceConnectorActionResult>;
}
