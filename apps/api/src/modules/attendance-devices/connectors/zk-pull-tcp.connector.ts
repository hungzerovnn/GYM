import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';
import {
  AttendanceDeviceAttendanceLogPayload,
  AttendanceDeviceCapability,
  AttendanceDeviceConnector,
  AttendanceDeviceConnectorActionResult,
  AttendanceDeviceLogRangePayload,
  AttendanceDeviceMachineRuntime,
  AttendanceDeviceUserPayload,
} from '../attendance-device.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Zkteco = require('zkteco-js');
const execFileAsync = promisify(execFile);

type ZkClient = {
  createSocket(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  getInfo(): Promise<{
    userCounts?: number;
    logCounts?: number;
    logCapacity?: number;
  }>;
  getUsers(): Promise<{
    data?: ZkMachineUserRecord[];
  }>;
  getAttendances(
    callback?: (current: number, total: number) => void,
  ): Promise<{
    data?: ZkAttendanceRecord[];
  }>;
  getTime(): Promise<Date>;
  setTime(time: Date): Promise<unknown>;
  getSerialNumber(): Promise<string>;
  getFirmware(): Promise<string>;
  getDeviceName(): Promise<string>;
  getPlatform(): Promise<string>;
  getVendor(): Promise<string>;
  getMacAddress(): Promise<string>;
  getFaceOn(): Promise<string>;
  getSSR(): Promise<string>;
  getAttendanceSize(): Promise<number>;
  clearAttendanceLog(): Promise<unknown>;
  disableDevice(): Promise<unknown>;
  enableDevice(): Promise<unknown>;
  setUser(
    uid: number,
    userId: string,
    name: string,
    password: string,
    role?: number,
    cardNo?: number,
  ): Promise<unknown>;
};

type ZkMachineUserRecord = {
  uid?: number;
  role?: number;
  password?: string;
  name?: string;
  cardno?: number;
  userId?: string;
};

type ZkAttendanceRecord = {
  sn?: number;
  user_id?: string;
  record_time?: string;
  type?: number;
  state?: number;
  ip?: string;
};

@Injectable()
export class ZkPullTcpAttendanceConnector implements AttendanceDeviceConnector {
  readonly key = 'zk-pull-tcp';
  readonly displayName = 'ZKTeco / Ronald Jack Pull TCP';
  readonly vendor = 'ZKTECO' as const;

  supports(machine: AttendanceDeviceMachineRuntime) {
    const vendor = String(machine.vendor || '').toUpperCase();
    const protocol = String(machine.protocol || '').toUpperCase();
    return (
      protocol === 'ZK_PULL_TCP' ||
      (['ZKTECO', 'RONALD_JACK'].includes(vendor) &&
        protocol !== 'ZK_ADMS_PUSH')
    );
  }

  getCapabilities(
    machine: AttendanceDeviceMachineRuntime,
  ): AttendanceDeviceCapability[] {
    const machineType = String(machine.machineType || '').toUpperCase();
    const supportsCard =
      ['CARD', 'HYBRID'].includes(machineType) ||
      Boolean(machine.supportsCardEnrollment);

    return [
      {
        key: 'zk_pull_tcp_ping',
        label: 'Ping / read device info via TCP 4370',
        supported: true,
        notes:
          'Doc thong tin may qua ZK pull TCP nhu user count, log count, firmware, serial va gio may.',
      },
      {
        key: 'zk_pull_tcp_user_pull',
        label: 'Pull users via ZK TCP',
        supported: true,
        notes:
          'Tai danh sach user dang ton tai tren may de doi soat ma may voi he thong.',
      },
      {
        key: 'zk_pull_tcp_log_pull',
        label: 'Pull attendance logs via ZK TCP',
        supported: true,
        notes:
          'Tai log cham cong qua giao thuc ZK TCP. Event type / verification method co the can suy luan tu payload ZK.',
      },
      {
        key: 'zk_pull_tcp_log_range_export',
        label: 'Export attendance logs by date range',
        supported: true,
        notes:
          'Co the doc log va loc theo khoang ngay trong app de tai ve may tinh ma khong import vao he thong.',
      },
      {
        key: 'zk_pull_tcp_log_range_delete',
        label: 'Delete logs on device by guarded date range',
        supported: true,
        notes:
          'Firmware ZK pull TCP thuong chi co lenh clear all attendance logs. App se chi cho xoa khi khoang ngay chon bao trum toan bo log hien co tren may.',
      },
      {
        key: 'zk_pull_tcp_log_full_export',
        label: 'Export all attendance logs on device',
        supported: true,
        notes:
          'Tai toan bo log dang con tren may ve may tinh ma khong import vao he thong.',
      },
      {
        key: 'zk_pull_tcp_log_full_delete',
        label: 'Delete all attendance logs on device',
        supported: true,
        notes:
          'Clear toan bo attendance log tren may ZK de giai phong bo nho. Nen tai file doi soat truoc khi xoa.',
      },
      {
        key: 'zk_pull_tcp_user_setup',
        label: 'Push users via ZK TCP',
        supported: true,
        notes:
          'Tao / cap nhat user tren may bang lenh CMD_USER_WRQ, phu hop cho staff va hoi vien co ma may ngan gon.',
      },
      {
        key: 'zk_pull_tcp_card_setup',
        label: 'Card enrollment via ZK TCP',
        supported: supportsCard,
        notes: supportsCard
          ? 'The duoc ghi cung lenh tao user neu card number hop le tren may ZK.'
          : 'May hien tai chua duoc khai bao theo luong the.',
      },
      {
        key: 'zk_pull_tcp_face_setup',
        label: 'Face enrollment',
        supported: false,
        notes:
          'Chua bat upload face template / image cho dong ZK pull TCP trong connector nay.',
      },
      {
        key: 'zk_pull_tcp_time_sync',
        label: 'Time sync',
        supported: true,
        notes:
          'Dong bo gio may qua lenh CMD_SET_TIME khi van hanh chu dong bam dong bo.',
      },
    ];
  }

  async ping(machine: AttendanceDeviceMachineRuntime) {
    return this.withClient(machine, async (client, target) => {
      const info = await client.getInfo();
      const attendanceSize = await this.readOptional(() =>
        client.getAttendanceSize(),
      );
      const deviceTime = await this.readOptional(() => client.getTime());
      const serialNumber = await this.readOptional(() =>
        client.getSerialNumber(),
      );
      const firmware = await this.readOptional(() => client.getFirmware());
      const deviceName = await this.readOptional(() => client.getDeviceName());
      const platform = await this.readOptional(() => client.getPlatform());
      const vendor = await this.readOptional(() => client.getVendor());
      const macAddress = await this.readOptional(() => client.getMacAddress());
      const faceOn = await this.readOptional(() => client.getFaceOn());
      const ssr = await this.readOptional(() => client.getSSR());

      return {
        connectorKey: this.key,
        supported: true,
        action: 'ping',
        message: 'Ket noi may ZK pull TCP thanh cong.',
        metadata: {
          machineCode: machine.code,
          host: target.host,
          connectionPort: target.port,
          vendor,
          serialNumber,
          firmware,
          deviceName,
          platform,
          macAddress,
          faceOn,
          ssr,
          deviceTime: deviceTime ? deviceTime.toISOString() : null,
          userCount: Number(info?.userCounts || 0),
          logCount: Number(info?.logCounts || 0),
          attendanceSize:
            typeof attendanceSize === 'number'
              ? attendanceSize
              : Number(info?.logCounts || 0),
          logCapacity: Number(info?.logCapacity || 0),
          commKeyConfigured: Boolean(machine.commKey),
        },
      };
    });
  }

  async syncTime(machine: AttendanceDeviceMachineRuntime) {
    return this.withClient(machine, async (client) => {
      const beforeTime = await this.readOptional(() => client.getTime());
      const targetTime = new Date();
      await client.setTime(targetTime);
      const afterTime = await this.readOptional(() => client.getTime());

      return {
        connectorKey: this.key,
        supported: true,
        action: 'syncTime',
        message: 'Da dong bo gio may qua giao thuc ZK pull TCP.',
        metadata: {
          machineCode: machine.code,
          timeZone: machine.timeZone || 'Asia/Bangkok',
          beforeTime: beforeTime ? beforeTime.toISOString() : null,
          syncedTime: targetTime.toISOString(),
          afterTime: afterTime ? afterTime.toISOString() : null,
        },
      };
    });
  }

  async pullAttendanceLogs(machine: AttendanceDeviceMachineRuntime) {
    const rows = await this.readAllAttendanceLogs(machine);
    const cursorTime = this.readCursorDate(machine.lastLogCursor);

    return rows.filter((item) => {
      if (!cursorTime) {
        return true;
      }

      return new Date(item.eventAt).getTime() > cursorTime.getTime();
    });
  }

  async pullAllAttendanceLogs(machine: AttendanceDeviceMachineRuntime) {
    return this.readAllAttendanceLogs(machine);
  }

  async pullAttendanceLogsByRange(
    machine: AttendanceDeviceMachineRuntime,
    range: AttendanceDeviceLogRangePayload,
  ) {
    const rows = await this.readAllAttendanceLogs(machine);
    return rows.filter((item) => this.isLogWithinRange(item, range));
  }

  async deleteAttendanceLogsByRange(
    machine: AttendanceDeviceMachineRuntime,
    range: AttendanceDeviceLogRangePayload,
  ) {
    const logs = await this.readAllAttendanceLogs(machine);
    const matchedLogs = logs.filter((item) => this.isLogWithinRange(item, range));
    const outsideRangeCount = Math.max(logs.length - matchedLogs.length, 0);

    if (!matchedLogs.length) {
      return {
        connectorKey: this.key,
        supported: true,
        action: 'deleteAttendanceLogsByRange',
        message:
          'Khong co log nao nam trong khoang ngay da chon tren may ZK, nen khong can xoa.',
        metadata: {
          machineCode: machine.code,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          totalLogsOnDevice: logs.length,
          matchedLogs: 0,
          outsideRangeCount,
          rangeCoveredAllLogs: false,
          deleteStrategy: 'CLEAR_ALL_ONLY',
          previewLogs: [],
        },
      };
    }

    if (outsideRangeCount > 0) {
      return {
        connectorKey: this.key,
        supported: false,
        action: 'deleteAttendanceLogsByRange',
        message:
          'May ZK hien chi ho tro clear toan bo attendance log. Khoang ngay da chon chua bao trum het log tren may, nen he thong chan xoa de tranh mat du lieu ngoai pham vi.',
        metadata: {
          machineCode: machine.code,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          totalLogsOnDevice: logs.length,
          matchedLogs: matchedLogs.length,
          outsideRangeCount,
          rangeCoveredAllLogs: false,
          deleteStrategy: 'CLEAR_ALL_ONLY',
          previewLogs: matchedLogs.slice(0, 8),
        },
      };
    }

    const clearResult = await this.runAttendanceLogWorker(
      machine,
      'clearAttendanceLog',
    );

    return {
      connectorKey: this.key,
      supported: true,
      action: 'deleteAttendanceLogsByRange',
      message:
        'Da clear attendance log tren may ZK. Khoang ngay da chon bao trum toan bo log hien co, nen xoa an toan de giai phong bo nho.',
      metadata: {
        machineCode: machine.code,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        totalLogsOnDevice: logs.length,
        matchedLogs: matchedLogs.length,
        outsideRangeCount: 0,
        deletedLogs: matchedLogs.length,
        rangeCoveredAllLogs: true,
        deleteStrategy: 'CLEAR_ALL_ONLY',
        remainingLogCount:
          typeof clearResult.remainingLogCount === 'number'
            ? clearResult.remainingLogCount
            : null,
        previewLogs: matchedLogs.slice(0, 8),
      },
    };
  }

  async deleteAllAttendanceLogs(machine: AttendanceDeviceMachineRuntime) {
    const logs = await this.readAllAttendanceLogs(machine);
    const clearResult = await this.runAttendanceLogWorker(
      machine,
      'clearAttendanceLog',
    );

    return {
      connectorKey: this.key,
      supported: true,
      action: 'deleteAllAttendanceLogs',
      message:
        'Da clear toan bo attendance log tren may ZK. Nen tai file doi soat truoc neu can luu tru offline.',
      metadata: {
        machineCode: machine.code,
        totalLogsOnDevice: logs.length,
        matchedLogs: logs.length,
        deletedLogs: logs.length,
        outsideRangeCount: 0,
        rangeCoveredAllLogs: true,
        deleteStrategy: 'CLEAR_ALL_EXPLICIT',
        remainingLogCount:
          typeof clearResult.remainingLogCount === 'number'
            ? clearResult.remainingLogCount
            : null,
        previewLogs: logs.slice(0, 8),
      },
    };
  }

  async pullUsers(machine: AttendanceDeviceMachineRuntime) {
    return this.withClient(machine, async (client) => {
      const response = await client.getUsers();
      const rows = Array.isArray(response?.data) ? response.data : [];

      const users = rows.map((row, index) => {
        const machineUserId =
          this.cleanText(row.userId) || String(row.uid || index + 1);

        return {
          personType: 'STAFF' as const,
          personId: machineUserId,
          displayName:
            this.cleanText(row.name) || `Machine user ${machineUserId}`,
          appAttendanceCode: machineUserId,
          machineUserId,
          machineCode: machineUserId,
          metadata: {
            uid: Number(row.uid || 0),
            role: Number(row.role || 0),
            cardNo: Number(row.cardno || 0),
          },
        };
      });

      return users.sort((left, right) =>
        this.compareMachineUserId(left.machineUserId, right.machineUserId),
      );
    });
  }

  async pushUsers(
    machine: AttendanceDeviceMachineRuntime,
    users: AttendanceDeviceUserPayload[],
  ) {
    return this.withClient(machine, async (client) => {
      const response = await client.getUsers();
      const existingUsers = Array.isArray(response?.data) ? response.data : [];
      const machineUserMap = new Map(
        existingUsers.map((item) => [
          this.normalizeKey(item.userId),
          item,
        ]),
      );
      const usedUids = new Set(
        existingUsers
          .map((item) => Number(item.uid || 0))
          .filter((item) => Number.isInteger(item) && item > 0),
      );

      let pushedUsers = 0;
      let pushedCards = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const user of users) {
        const machineUserId = this.resolveMachineUserId(user);
        if (!machineUserId) {
          errors.push(`Bo qua ${user.displayName}: thieu machine user id.`);
          continue;
        }

        if (machineUserId.length > 9) {
          errors.push(
            `${machineUserId}: ma may dai hon 9 ky tu, can rut gon truoc khi day len may ZK.`,
          );
          continue;
        }

        const existing = machineUserMap.get(this.normalizeKey(machineUserId));
        const nextUid = existing?.uid || this.nextAvailableUid(usedUids);
        if (!nextUid) {
          errors.push(
            `${machineUserId}: khong tim duoc UID trong khoang 1..3000 de tao user tren may.`,
          );
          continue;
        }

        const cardNo = this.parseCardNumber(user.cardCode);
        if (user.cardCode && cardNo === null) {
          warnings.push(
            `${machineUserId}: cardCode khong hop le cho lenh ZK, user van duoc tao nhung khong ghi the.`,
          );
        }

        try {
          await client.setUser(
            nextUid,
            machineUserId,
            this.sanitizeDeviceName(user.displayName, machineUserId),
            '',
            0,
            cardNo || 0,
          );
          pushedUsers += 1;
          if (cardNo) {
            pushedCards += 1;
          }
          usedUids.add(nextUid);
          machineUserMap.set(this.normalizeKey(machineUserId), {
            uid: nextUid,
            userId: machineUserId,
            name: user.displayName,
            cardno: cardNo || 0,
          });
        } catch (error) {
          errors.push(`${machineUserId}: ${this.describeError(error)}`);
        }
      }

      return {
        connectorKey: this.key,
        supported: true,
        action: 'pushUsers',
        message:
          errors.length > 0
            ? 'Da goi lenh day user len may ZK, nhung con mot so ban ghi bi loi.'
            : warnings.length > 0
              ? 'Da day user len may ZK, nhung mot so cardCode khong hop le nen chi tao user.'
              : 'Da day user len may ZK pull TCP.',
        metadata: {
          machineCode: machine.code,
          requestedUsers: users.length,
          pushedUsers,
          pushedCards,
          failedUsers: errors.length,
          warningCount: warnings.length,
          errors: errors.slice(0, 20),
          warnings: warnings.slice(0, 20),
        },
      };
    });
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
    if (payload.enrollmentType !== 'CARD') {
      return {
        connectorKey: this.key,
        supported: false,
        action: 'createEnrollment',
        message:
          payload.enrollmentType === 'FACE'
            ? 'Dong ZK pull TCP hien chua bat upload khuon mat tu app. Can enroll face truc tiep tren may hoac them luong template rieng.'
            : 'Dong ZK pull TCP hien chua bat dong bo fingerprint template tu app.',
        metadata: {
          machineCode: machine.code,
          enrollmentType: payload.enrollmentType,
          machineUserId:
            payload.machineUserId || payload.machineCode || payload.personId,
        },
      };
    }

    const machineUserId = this.resolveMachineUserId({
      personType: payload.personType,
      personId: payload.personId,
      displayName: payload.displayName || payload.personId,
      appAttendanceCode: payload.appAttendanceCode,
      machineUserId: payload.machineUserId,
      machineCode: payload.machineCode,
      cardCode: payload.cardCode,
    });

    if (!machineUserId) {
      throw new BadRequestException(
        'Khong the enroll the vi thieu machine user id / attendance code.',
      );
    }

    if (machineUserId.length > 9) {
      throw new BadRequestException(
        'Ma may cho ZK chi nen toi da 9 ky tu khi enroll the.',
      );
    }

    const cardNo = this.parseCardNumber(payload.cardCode);
    if (!cardNo) {
      return {
        connectorKey: this.key,
        supported: false,
        action: 'createEnrollment',
        message:
          'Card enrollment tren ZK can cardCode dang so hop le de ghi vao user profile tren may.',
        metadata: {
          machineCode: machine.code,
          machineUserId,
          cardCode: payload.cardCode || '',
        },
      };
    }

    return this.withClient(machine, async (client) => {
      const response = await client.getUsers();
      const existingUsers = Array.isArray(response?.data) ? response.data : [];
      const existing = existingUsers.find(
        (item) => this.normalizeKey(item.userId) === this.normalizeKey(machineUserId),
      );
      const uid =
        existing?.uid ||
        this.nextAvailableUid(
          new Set(
            existingUsers
              .map((item) => Number(item.uid || 0))
              .filter((item) => Number.isInteger(item) && item > 0),
          ),
        );

      if (!uid) {
        throw new BadRequestException(
          'Khong tim duoc UID hop le de tao user the tren may ZK.',
        );
      }

      await client.setUser(
        uid,
        machineUserId,
        this.sanitizeDeviceName(payload.displayName, machineUserId),
        '',
        0,
        cardNo,
      );

      return {
        connectorKey: this.key,
        supported: true,
        action: 'createEnrollment',
        message: 'Da tao / cap nhat enrollment the tren may ZK.',
        metadata: {
          machineCode: machine.code,
          enrollmentType: payload.enrollmentType,
          machineUserId,
          uid,
          cardCode: String(cardNo),
        },
      };
    });
  }

  private async withClient<T>(
    machine: AttendanceDeviceMachineRuntime,
    task: (
      client: ZkClient,
      target: { host: string; port: number },
    ) => Promise<T>,
  ): Promise<T> {
    const target = this.resolveTarget(machine);
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const client = new Zkteco(target.host, target.port, 15000, 5000) as ZkClient;
      try {
        await client.createSocket();
        return await task(client, target);
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } finally {
        try {
          await client.disconnect();
        } catch {
          // noop
        }
      }
    }

    throw new BadRequestException(
      `ZK pull TCP khong ket noi duoc toi ${target.host}:${target.port}. ${this.describeError(
        lastError,
      )}`,
    );
  }

  private async readAllAttendanceLogs(
    machine: AttendanceDeviceMachineRuntime,
  ): Promise<AttendanceDeviceAttendanceLogPayload[]> {
    const response = await this.runAttendanceLogWorker(machine, 'getAttendances');
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.flatMap((row) => {
      const mapped = this.mapAttendanceLog(machine, row as ZkAttendanceRecord);
      return mapped ? [mapped] : [];
    });
  }

  private resolveTarget(machine: AttendanceDeviceMachineRuntime) {
    const rawHost = this.cleanText(machine.host);
    if (!rawHost) {
      throw new BadRequestException('May ZK chua duoc cau hinh host / IP.');
    }

    let host = rawHost;
    let portFromHost: number | undefined;

    if (/^https?:\/\//i.test(rawHost)) {
      const url = new URL(rawHost);
      host = url.hostname;
      if (url.port) {
        portFromHost = Number(url.port);
      }
    } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(rawHost)) {
      const [nextHost, nextPort] = rawHost.split(':');
      host = nextHost;
      portFromHost = Number(nextPort);
    }

    const port = Number(machine.connectionPort || portFromHost || 4370);
    if (!Number.isInteger(port) || port <= 0) {
      throw new BadRequestException(
        'Cong ket noi cho may ZK khong hop le. Vui long kiem tra connectionPort.',
      );
    }

    return {
      host,
      port,
    };
  }

  private mapAttendanceLog(
    machine: AttendanceDeviceMachineRuntime,
    row: ZkAttendanceRecord,
  ) {
    const machineUserId = this.cleanText(row.user_id);
    const eventAt = this.parseRecordDate(row.record_time);

    if (!machineUserId || !eventAt) {
      return null;
    }

    return {
      externalEventId: [
        machine.code,
        machineUserId,
        eventAt.toISOString(),
        Number(row.sn || 0),
      ].join(':'),
      machineUserId,
      appAttendanceCode: machineUserId,
      rawCode: machineUserId,
      eventAt: eventAt.toISOString(),
      eventType: this.resolveEventType(row.state),
      verificationMethod: this.resolveVerificationMethod(machine, row.type),
      payload: {
        sn: Number(row.sn || 0),
        type: Number(row.type || 0),
        state: Number(row.state || 0),
        ip: this.cleanText(row.ip),
      },
    };
  }

  private resolveEventType(state?: number) {
    return [1, 2, 5].includes(Number(state || 0))
      ? ('CHECK_OUT' as const)
      : ('CHECK_IN' as const);
  }

  private resolveVerificationMethod(
    machine: AttendanceDeviceMachineRuntime,
    verifyType?: number,
  ) {
    const normalizedType = Number(verifyType || 0);
    if ([15, 16, 19].includes(normalizedType)) {
      return 'FACE' as const;
    }
    if ([2, 4, 11, 14].includes(normalizedType)) {
      return 'CARD' as const;
    }
    if ([1, 3, 6, 8, 9].includes(normalizedType)) {
      return 'FINGERPRINT' as const;
    }

    const machineType = String(machine.machineType || '').toUpperCase();
    if (machineType === 'CARD') {
      return 'CARD' as const;
    }
    if (machineType === 'FACE') {
      return 'FACE' as const;
    }
    return 'FINGERPRINT' as const;
  }

  private resolveMachineUserId(user: AttendanceDeviceUserPayload) {
    const rawValue =
      user.machineUserId ||
      user.machineCode ||
      user.appAttendanceCode ||
      user.personId ||
      '';
    return this.cleanText(rawValue);
  }

  private cleanText(value: unknown) {
    return String(value || '').replace(/\u0000/g, '').trim();
  }

  private normalizeKey(value: unknown) {
    return this.cleanText(value).toUpperCase();
  }

  private compareMachineUserId(left?: string, right?: string) {
    const leftValue = this.cleanText(left);
    const rightValue = this.cleanText(right);
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    const leftNumeric = leftValue !== '' && Number.isInteger(leftNumber);
    const rightNumeric = rightValue !== '' && Number.isInteger(rightNumber);

    if (leftNumeric && rightNumeric) {
      return leftNumber - rightNumber;
    }

    if (leftNumeric) {
      return -1;
    }

    if (rightNumeric) {
      return 1;
    }

    return leftValue.localeCompare(rightValue);
  }

  private sanitizeDeviceName(displayName: string, fallback: string) {
    const ascii = this.cleanText(
      (displayName || fallback)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, ''),
    );
    return (ascii || fallback || 'FITFLOW').slice(0, 24);
  }

  private parseCardNumber(cardCode?: string) {
    const digits = String(cardCode || '').replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    const cardNo = Number(digits);
    if (!Number.isInteger(cardNo) || cardNo <= 0 || cardNo > 65535) {
      return null;
    }

    return cardNo;
  }

  private nextAvailableUid(usedUids: Set<number>) {
    const maxUid = Math.max(0, ...Array.from(usedUids.values()));
    for (
      let candidate = Math.max(1, maxUid + 1);
      candidate <= 3000;
      candidate += 1
    ) {
      if (!usedUids.has(candidate)) {
        return candidate;
      }
    }

    for (let candidate = 1; candidate <= 3000; candidate += 1) {
      if (!usedUids.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private parseRecordDate(value?: string) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private readCursorDate(value?: string | null) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private isLogWithinRange(
    item: AttendanceDeviceAttendanceLogPayload,
    range: AttendanceDeviceLogRangePayload,
  ) {
    const eventTime = new Date(item.eventAt).getTime();
    return (
      eventTime >= new Date(range.startAt).getTime() &&
      eventTime <= new Date(range.endAt).getTime()
    );
  }

  private async readOptional<T>(reader: () => Promise<T>) {
    try {
      return await reader();
    } catch {
      return null;
    }
  }

  private describeError(error: unknown) {
    if (!error) {
      return 'Khong ro chi tiet loi tu thiet bi.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'object') {
      const nestedError = error as {
        message?: unknown;
        err?: { message?: unknown; err?: { message?: unknown; code?: unknown } };
        code?: unknown;
      };

      if (typeof nestedError.message === 'string' && nestedError.message.trim()) {
        return nestedError.message;
      }

      if (
        typeof nestedError.err?.message === 'string' &&
        nestedError.err.message.trim()
      ) {
        return nestedError.err.message;
      }

      if (
        typeof nestedError.err?.err?.message === 'string' &&
        nestedError.err.err.message.trim()
      ) {
        return nestedError.err.err.message;
      }

      if (
        typeof nestedError.err?.err?.code === 'string' &&
        nestedError.err.err.code.trim()
      ) {
        return nestedError.err.err.code;
      }
    }

    return String(error);
  }

  private shouldRetryWorkerOperation(error: unknown) {
    const message = this.describeError(error).toUpperCase();
    return (
      message.includes('TIMEOUT') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('SOCKET') ||
      message.includes('EPIPE')
    );
  }

  private async runAttendanceLogWorker(
    machine: AttendanceDeviceMachineRuntime,
    operation: 'getAttendances' | 'clearAttendanceLog',
  ): Promise<{
    data?: unknown[];
    remainingLogCount?: number | null;
  }> {
    const target = this.resolveTarget(machine);
    const runnerPath = resolve(
      __dirname,
      '../../../../tools/zk-pull-tcp-log-runner.cjs',
    );
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { stdout } = await execFileAsync(
          process.execPath,
          [runnerPath, target.host, String(target.port), operation],
          {
            timeout: 180000,
            maxBuffer: 128 * 1024 * 1024,
          },
        );
        const payload = JSON.parse(String(stdout || '{}')) as {
          ok?: boolean;
          error?: string;
          data?: unknown[];
          remainingLogCount?: number | null;
        };

        if (!payload.ok) {
          throw new BadRequestException(
            payload.error ||
              'Khong doc duoc log attendance tu may ZK qua worker an toan.',
          );
        }

        return {
          data: Array.isArray(payload.data) ? payload.data : [],
          remainingLogCount:
            payload.remainingLogCount === null ||
            payload.remainingLogCount === undefined
              ? null
              : Number(payload.remainingLogCount),
        };
      } catch (error) {
        lastError = error;
        const runnerError = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        const stdoutPayload = String(runnerError.stdout || '').trim();

        if (stdoutPayload) {
          try {
            const payload = JSON.parse(stdoutPayload) as {
              error?: string;
            };
            if (payload.error) {
              lastError = new BadRequestException(payload.error);
            }
          } catch {
            // noop
          }
        }

        if (
          attempt === 0 &&
          this.shouldRetryWorkerOperation(
            runnerError.stderr ||
              runnerError.stdout ||
              runnerError.message ||
              lastError,
          )
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
      }
    }

    throw new BadRequestException(
      `Khong doc duoc log attendance tu may ZK. ${this.describeError(
        lastError,
      )}`,
    );
  }
}
