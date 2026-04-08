import { Injectable } from '@nestjs/common';
import {
  AttendanceDeviceCapability,
  AttendanceDeviceConnector,
  AttendanceDeviceConnectorActionResult,
  AttendanceDeviceMachineRuntime,
  AttendanceDeviceUserPayload,
} from '../attendance-device.types';

@Injectable()
export class GenericExportAttendanceConnector
  implements AttendanceDeviceConnector
{
  readonly key = 'generic-export';
  readonly displayName = 'Generic export / offline bridge';
  readonly vendor = 'GENERIC' as const;

  supports(machine: AttendanceDeviceMachineRuntime) {
    const protocol = String(machine.protocol || '').toUpperCase();
    return (
      !protocol ||
      protocol === 'GENERIC_EXPORT' ||
      protocol === 'CSV_IMPORT' ||
      protocol === 'GENERIC_HTTP'
    );
  }

  getCapabilities(
    machine: AttendanceDeviceMachineRuntime,
  ): AttendanceDeviceCapability[] {
    return [
      {
        key: 'offline_user_export',
        label: 'Offline user export',
        supported: true,
        notes:
          'Can xuat danh sach ma nhan vien/hoi vien de gan ma bang tay hoac qua bridge ngoai.',
      },
      {
        key: 'offline_log_import',
        label: 'Offline log import',
        supported: true,
        notes:
          'Cho phep lam lop dem cho truong hop chua co SDK vendor, duoc dung de import JSON/CSV log sau.',
      },
      {
        key: 'face_image_transport',
        label: 'Face image transport',
        supported: Boolean(machine.supportsFaceImage),
        notes: machine.supportsFaceImage
          ? 'Machine da duoc khai bao co kha nang trao doi anh khuon mat.'
          : 'Machine chua duoc khai bao co kha nang trao doi anh khuon mat.',
      },
      {
        key: 'face_template_transport',
        label: 'Face template transport',
        supported: Boolean(machine.supportsFaceTemplate),
        notes: machine.supportsFaceTemplate
          ? 'Machine da duoc khai bao co kha nang trao doi template khuon mat.'
          : 'Machine chua co connector de xu ly template khuon mat.',
      },
      {
        key: 'card_enrollment',
        label: 'Card enrollment',
        supported: Boolean(machine.supportsCardEnrollment),
        notes: machine.supportsCardEnrollment
          ? 'Machine cho phep khai bao vong doi the qua connector sau nay.'
          : 'Chi moi duoc scaffold metadata, chua co connector the thuc te.',
      },
      {
        key: 'webhook_push',
        label: 'Webhook push',
        supported: Boolean(machine.supportsWebhook),
        notes: machine.supportsWebhook
          ? 'Machine da duoc khai bao push/webhook.'
          : 'Machine hien chua co webhook bridge.',
      },
    ];
  }

  async ping(machine: AttendanceDeviceMachineRuntime) {
    return this.unsupported(machine, 'ping', {
      host: machine.host || '',
      connectionPort: machine.connectionPort || '',
      protocol: machine.protocol || '',
    });
  }

  async syncTime(machine: AttendanceDeviceMachineRuntime) {
    return this.unsupported(machine, 'syncTime', {
      timeZone: machine.timeZone || 'Asia/Bangkok',
    });
  }

  async pullAttendanceLogs() {
    return [];
  }

  async pullUsers() {
    return [];
  }

  async pushUsers(
    _machine: AttendanceDeviceMachineRuntime,
    users: AttendanceDeviceUserPayload[],
  ) {
    return {
      connectorKey: this.key,
      supported: false,
      action: 'pushUsers',
      message:
        'Connector generic-export hien chi scaffold luong dong bo. Chua co vendor SDK de day user vao may thuc te.',
      metadata: {
        preparedUsers: users.length,
      },
    };
  }

  async createEnrollment(
    machine: AttendanceDeviceMachineRuntime,
    payload: {
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
    },
  ) {
    return this.unsupported(machine, 'createEnrollment', payload);
  }

  private unsupported(
    machine: AttendanceDeviceMachineRuntime,
    action: string,
    metadata?: Record<string, unknown>,
  ): AttendanceDeviceConnectorActionResult {
    return {
      connectorKey: this.key,
      supported: false,
      action,
      message:
        'Machine nay dang dung scaffold generic-export. He thong da co day du schema/mapping/enrollment foundation, nhung chua co connector vendor thuc te de noi voi thiet bi.',
      metadata: {
        machineCode: machine.code,
        machineType: machine.machineType,
        protocol: machine.protocol,
        ...metadata,
      },
    };
  }
}
