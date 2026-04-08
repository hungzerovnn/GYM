import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceDeviceRegistry } from './attendance-device.registry';
import {
  AttendanceDeviceLogRangePayload,
  AttendanceDeviceUserPayload,
} from './attendance-device.types';

type AttendanceDeviceEnrollmentPayload = {
  personType: 'STAFF' | 'CUSTOMER';
  personId: string;
  enrollmentType: 'FACE' | 'CARD' | 'FINGERPRINT';
  displayName?: string;
  appAttendanceCode?: string;
  machineCode?: string;
  machineUserId?: string;
  cardCode?: string;
  faceImageUrl?: string;
  faceImageBase64?: string;
};

@Injectable()
export class AttendanceDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AttendanceDeviceRegistry,
  ) {}

  listConnectors() {
    return this.registry.listConnectors();
  }

  async pingMachine(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: await connector.ping(runtime),
    };
  }

  async syncMachineTime(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: await connector.syncTime(runtime),
    };
  }

  async pullAttendanceLogs(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      logs: await connector.pullAttendanceLogs(runtime),
    };
  }

  async pullAllAttendanceLogs(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    const logs = connector.pullAllAttendanceLogs
      ? await connector.pullAllAttendanceLogs(runtime)
      : connector.pullAttendanceLogsByRange
        ? await connector.pullAttendanceLogsByRange(runtime, {
            dateFrom: '1900-01-01',
            dateTo: '2099-12-31',
            startAt: new Date('1900-01-01T00:00:00.000+07:00').toISOString(),
            endAt: new Date('2099-12-31T23:59:59.999+07:00').toISOString(),
          })
        : await connector.pullAttendanceLogs(runtime);

    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      logs,
    };
  }

  async pullAttendanceLogsByRange(
    machineId: string,
    range: AttendanceDeviceLogRangePayload,
  ) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    const logs = connector.pullAttendanceLogsByRange
      ? await connector.pullAttendanceLogsByRange(runtime, range)
      : (await connector.pullAttendanceLogs(runtime)).filter((log) => {
          const eventTime = new Date(log.eventAt).getTime();
          return (
            eventTime >= new Date(range.startAt).getTime() &&
            eventTime <= new Date(range.endAt).getTime()
          );
        });

    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      logs,
    };
  }

  async pullMachineUsers(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      users: await connector.pullUsers(runtime),
    };
  }

  async pushUsers(machineId: string, users: AttendanceDeviceUserPayload[]) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: await connector.pushUsers(runtime, users),
    };
  }

  async createEnrollment(
    machineId: string,
    payload: AttendanceDeviceEnrollmentPayload,
  ) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: await connector.createEnrollment(runtime, payload),
    };
  }

  async deleteAttendanceLogsByRange(
    machineId: string,
    range: AttendanceDeviceLogRangePayload,
  ) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    const fallbackResult = {
      connectorKey: connector.key,
      supported: false,
      action: 'deleteAttendanceLogsByRange',
      message:
        'Connector hien tai chua ho tro xoa log theo moc thoi gian tren may cham cong.',
      metadata: {
        machineCode: runtime.code,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        deleteStrategy: 'UNSUPPORTED',
      },
    };

    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: connector.deleteAttendanceLogsByRange
        ? await connector.deleteAttendanceLogsByRange(runtime, range)
        : fallbackResult,
    };
  }

  async deleteAllAttendanceLogs(machineId: string) {
    const { connector, runtime } = await this.resolveMachineConnector(machineId);
    const fallbackResult = {
      connectorKey: connector.key,
      supported: false,
      action: 'deleteAllAttendanceLogs',
      message:
        'Connector hien tai chua ho tro xoa toan bo log tren may cham cong.',
      metadata: {
        machineCode: runtime.code,
        deleteStrategy: 'UNSUPPORTED',
      },
    };

    return {
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      result: connector.deleteAllAttendanceLogs
        ? await connector.deleteAllAttendanceLogs(runtime)
        : fallbackResult,
    };
  }

  async getMachineFoundation(machineId: string) {
    const machine = await this.prisma.attendanceMachine.findUnique({
      where: { id: machineId },
      include: {
        _count: {
          select: {
            personMappings: true,
            attendanceEnrollments: true,
            biometricAssets: true,
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Attendance machine not found');
    }

    const runtime = this.toRuntime(machine);

    const connector = this.registry.resolveConnector(runtime);
    const capabilities = connector.getCapabilities(runtime);

    return {
      machine: {
        id: machine.id,
        code: machine.code,
        name: machine.name,
        vendor: machine.vendor,
        machineType: machine.machineType,
        protocol: machine.protocol,
        host: machine.host,
        connectionPort: machine.connectionPort,
        connectionStatus: machine.connectionStatus,
        syncEnabled: machine.syncEnabled,
      },
      connector: {
        key: connector.key,
        displayName: connector.displayName,
        vendor: connector.vendor,
      },
      capabilities,
      foundationChecklist: [
        {
          key: 'machine_metadata',
          label: 'Machine metadata',
          ready: Boolean(machine.vendor && machine.machineType && machine.protocol),
        },
        {
          key: 'connectivity_metadata',
          label: 'Connectivity metadata',
          ready: Boolean(machine.host && machine.connectionPort),
        },
        {
          key: 'person_mappings',
          label: 'Person to machine mapping',
          ready: machine._count.personMappings > 0,
          count: machine._count.personMappings,
        },
        {
          key: 'enrollment_records',
          label: 'Enrollment records',
          ready: machine._count.attendanceEnrollments > 0,
          count: machine._count.attendanceEnrollments,
        },
        {
          key: 'biometric_assets',
          label: 'Biometric assets',
          ready: machine._count.biometricAssets > 0,
          count: machine._count.biometricAssets,
        },
      ],
    };
  }

  private async resolveMachineConnector(machineId: string) {
    const machine = await this.prisma.attendanceMachine.findUnique({
      where: { id: machineId },
    });
    if (!machine) {
      throw new NotFoundException('Attendance machine not found');
    }

    const runtime = this.toRuntime(machine);
    const connector = this.registry.resolveConnector(runtime);

    return {
      machine,
      runtime,
      connector,
    };
  }

  private toRuntime(machine: {
    id: string;
    code: string;
    name: string;
    branchId: string;
    vendor: string;
    machineType: string;
    protocol: string;
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
    supportsFaceImage?: boolean | null;
    supportsFaceTemplate?: boolean | null;
    supportsCardEnrollment?: boolean | null;
    supportsFingerprintTemplate?: boolean | null;
    supportsWebhook?: boolean | null;
    lastHeartbeatAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    lastLogCursor?: string | null;
    lastUserSyncCursor?: string | null;
  }) {
    return {
      id: machine.id,
      code: machine.code,
      name: machine.name,
      branchId: machine.branchId,
      vendor: machine.vendor,
      machineType: machine.machineType,
      protocol: machine.protocol,
      model: machine.model,
      deviceIdentifier: machine.deviceIdentifier,
      host: machine.host,
      connectionPort: machine.connectionPort,
      username: machine.username,
      password: machine.password,
      apiKey: machine.apiKey,
      commKey: machine.commKey,
      webhookSecret: machine.webhookSecret,
      timeZone: machine.timeZone,
      pollingIntervalSeconds: machine.pollingIntervalSeconds,
      apiKeyConfigured: Boolean(machine.apiKey),
      passwordConfigured: Boolean(machine.password),
      webhookConfigured: Boolean(machine.webhookSecret),
      supportsFaceImage: Boolean(machine.supportsFaceImage),
      supportsFaceTemplate: Boolean(machine.supportsFaceTemplate),
      supportsCardEnrollment: Boolean(machine.supportsCardEnrollment),
      supportsFingerprintTemplate: Boolean(machine.supportsFingerprintTemplate),
      supportsWebhook: Boolean(machine.supportsWebhook),
      lastHeartbeatAt: machine.lastHeartbeatAt?.toISOString() || null,
      lastErrorCode: machine.lastErrorCode,
      lastErrorMessage: machine.lastErrorMessage,
      lastLogCursor: machine.lastLogCursor,
      lastUserSyncCursor: machine.lastUserSyncCursor,
    };
  }
}
