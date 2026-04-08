import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  AttendanceDeviceCapability,
  AttendanceDeviceConnector,
  AttendanceDeviceConnectorActionResult,
  AttendanceDeviceMachineRuntime,
  AttendanceDeviceUserPayload,
} from '../attendance-device.types';

type HikvisionJson = Record<string, unknown>;

@Injectable()
export class HikvisionIsapiAttendanceConnector
  implements AttendanceDeviceConnector
{
  readonly key = 'hikvision-isapi';
  readonly displayName = 'Hikvision ISAPI';
  readonly vendor = 'HIKVISION' as const;

  supports(machine: AttendanceDeviceMachineRuntime) {
    const vendor = String(machine.vendor || '').toUpperCase();
    const protocol = String(machine.protocol || '').toUpperCase();
    return vendor === 'HIKVISION' || protocol === 'HIKVISION_ISAPI';
  }

  getCapabilities(
    machine: AttendanceDeviceMachineRuntime,
  ): AttendanceDeviceCapability[] {
    const isFaceMachine = ['FACE', 'HYBRID'].includes(
      String(machine.machineType || '').toUpperCase(),
    );
    const isCardMachine = ['CARD', 'HYBRID'].includes(
      String(machine.machineType || '').toUpperCase(),
    );

    return [
      {
        key: 'hikvision_user_search',
        label: 'User search via ISAPI',
        supported: true,
        notes:
          'Dung endpoint chinh thuc /ISAPI/AccessControl/UserInfo/Search?format=json de lay danh sach user tren may.',
      },
      {
        key: 'hikvision_user_setup',
        label: 'User setup via ISAPI',
        supported: true,
        notes:
          'Dung endpoint chinh thuc /ISAPI/AccessControl/UserInfo/SetUp?format=json de tao/cap nhat user tren may.',
      },
      {
        key: 'hikvision_card_setup',
        label: 'Card setup via ISAPI',
        supported: isCardMachine || Boolean(machine.supportsCardEnrollment),
        notes:
          'Dung endpoint chinh thuc /ISAPI/AccessControl/CardInfo/SetUp?format=json de tao/cap nhat the.',
      },
      {
        key: 'hikvision_face_setup',
        label: 'Face setup via ISAPI',
        supported: isFaceMachine || Boolean(machine.supportsFaceImage),
        notes:
          'Dung endpoint chinh thuc /ISAPI/Intelligent/FDLib/FDSetUp?format=json, can co faceImageUrl hoac asset trung gian.',
      },
      {
        key: 'hikvision_log_polling',
        label: 'Attendance log polling',
        supported: true,
        notes:
          'Dung endpoint AccessControl AcsEvent de poll su kien cham cong, sau do map ve ma nhan vien/ma the trong he thong.',
      },
      {
        key: 'hikvision_time_sync',
        label: 'Time sync',
        supported: false,
        notes:
          'Can chot endpoint set time theo model firmware. Tam thoi chua bat buoc de tranh goi sai lenh vao may that.',
      },
    ];
  }

  async ping(machine: AttendanceDeviceMachineRuntime) {
    const result = await this.requestJson(
      machine,
      'GET',
      '/ISAPI/AccessControl/UserInfo/Count?format=json',
    );

    return {
      connectorKey: this.key,
      supported: true,
      action: 'ping',
      message: 'Ket noi Hikvision ISAPI thanh cong.',
      metadata: {
        machineCode: machine.code,
        host: machine.host,
        connectionPort: machine.connectionPort,
        userCount:
          Number(
            this.readPath(result, ['UserInfoCount', 'userNumber']) ??
              this.readPath(result, ['UserInfoCount', 'count']) ??
              0,
          ) || 0,
      },
    };
  }

  async syncTime(machine: AttendanceDeviceMachineRuntime) {
    return {
      connectorKey: this.key,
      supported: false,
      action: 'syncTime',
      message:
        'Connector Hikvision da duoc noi that cho user/card/face. Endpoint dong bo gio theo model firmware van dang duoc khoa de tranh goi lenh sai vao thiet bi.',
      metadata: {
        machineCode: machine.code,
        timeZone: machine.timeZone || 'Asia/Bangkok',
      },
    };
  }

  async pullAttendanceLogs(machine: AttendanceDeviceMachineRuntime) {
    const logs: Array<{
      externalEventId?: string;
      machineUserId?: string;
      appAttendanceCode?: string;
      rawCode?: string;
      eventAt: string;
      eventType: 'CHECK_IN' | 'CHECK_OUT';
      verificationMethod: 'FINGERPRINT' | 'FACE' | 'CARD' | 'MOBILE' | 'MANUAL';
      payload?: Record<string, unknown>;
    }> = [];
    let searchResultPosition = 0;
    const maxResults = 30;
    const now = new Date();
    const startTime = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);

    while (true) {
      const payload = {
        AcsEventCond: {
          searchID: `fitflow-acs-${Date.now()}-${searchResultPosition}`,
          searchResultPosition,
          maxResults,
          major: 0,
          minor: 0,
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
        },
      };

      const response = await this.requestJson(
        machine,
        'POST',
        '/ISAPI/AccessControl/AcsEvent?format=json',
        payload,
      );

      const searchBlock = (response.AcsEvent || response) as HikvisionJson;
      const matches = this.readMatches(searchBlock, 'InfoList');

      const currentBatch = matches
        .map((item) => ((item.AcsEventInfo || item) as HikvisionJson))
        .filter(Boolean)
        .map((eventInfo) => {
          const employeeNo = String(
            eventInfo.employeeNoString ||
              eventInfo.employeeNo ||
              eventInfo.userId ||
              eventInfo.cardNo ||
              '',
          ).trim();
          const rawCode = employeeNo || String(eventInfo.cardNo || '').trim();
          const eventAt = String(
            eventInfo.time ||
              eventInfo.eventTime ||
              eventInfo.swipeTime ||
              now.toISOString(),
          );
          const major = String(eventInfo.major || '').trim();
          const minor = String(eventInfo.minor || '').trim();

          return {
            externalEventId: [
              machine.code,
              major,
              minor,
              rawCode,
              eventAt,
            ]
              .filter(Boolean)
              .join(':'),
            machineUserId: employeeNo || undefined,
            appAttendanceCode: employeeNo || undefined,
            rawCode: rawCode || undefined,
            eventAt,
            eventType: this.resolveEventType(eventInfo),
            verificationMethod: this.resolveVerificationMethod(eventInfo),
            payload: eventInfo,
          };
        });

      logs.push(...currentBatch);

      const totalMatches = Number(
        searchBlock.totalMatches ||
          searchBlock.numOfMatches ||
          currentBatch.length ||
          0,
      );

      if (
        !currentBatch.length ||
        currentBatch.length < maxResults ||
        (totalMatches > 0 && logs.length >= totalMatches)
      ) {
        break;
      }

      searchResultPosition += currentBatch.length;
    }

    return logs;
  }

  async pullUsers(machine: AttendanceDeviceMachineRuntime) {
    const users: AttendanceDeviceUserPayload[] = [];
    let searchResultPosition = 0;
    const maxResults = 30;

    while (true) {
      const payload = {
        UserInfoSearchCond: {
          searchID: `fitflow-${Date.now()}-${searchResultPosition}`,
          searchResultPosition,
          maxResults,
        },
      };

      const response = await this.requestJson(
        machine,
        'POST',
        '/ISAPI/AccessControl/UserInfo/Search?format=json',
        payload,
      );

      const searchBlock = (response.UserInfoSearch ||
        response.UserInfoSearchResult ||
        response) as HikvisionJson;
      const matches = this.readMatches(searchBlock, 'MatchList');

      const currentBatch = matches
        .map((item) => ((item.UserInfo || item) as HikvisionJson))
        .filter(Boolean)
        .map((userInfo) => {
          const employeeNo = String(
            userInfo.employeeNo ||
              userInfo.employeeNoString ||
              userInfo.userID ||
              '',
          ).trim();

          return {
            personType: 'STAFF' as const,
            personId: employeeNo || `hik-${searchResultPosition}`,
            displayName: String(userInfo.name || employeeNo || '').trim(),
            appAttendanceCode: employeeNo,
            machineUserId: employeeNo,
            machineCode: employeeNo,
            metadata: {
              vendorPayload: userInfo,
            },
          };
        });

      users.push(...currentBatch);

      const totalMatches = Number(
        searchBlock.totalMatches || currentBatch.length || 0,
      );

      if (
        !currentBatch.length ||
        currentBatch.length < maxResults ||
        (totalMatches > 0 && users.length >= totalMatches)
      ) {
        break;
      }

      searchResultPosition += currentBatch.length;
    }

    return users;
  }

  async pushUsers(
    machine: AttendanceDeviceMachineRuntime,
    users: AttendanceDeviceUserPayload[],
  ) {
    const errors: string[] = [];
    let pushedUsers = 0;
    let pushedCards = 0;

    for (const user of users) {
      const employeeNo = this.resolveEmployeeNo(user);
      if (!employeeNo) {
        errors.push(`Bo qua ${user.displayName}: thieu attendance code / machine user id.`);
        continue;
      }

      try {
        await this.requestJson(
          machine,
          'PUT',
          '/ISAPI/AccessControl/UserInfo/SetUp?format=json',
          {
            UserInfo: {
              employeeNo,
              name: user.displayName || employeeNo,
              userType: 'normal',
              localUIRight: false,
              Valid: {
                enable: true,
              },
            },
          },
        );
        pushedUsers += 1;

        if (user.cardCode) {
          await this.requestJson(
            machine,
            'PUT',
            '/ISAPI/AccessControl/CardInfo/SetUp?format=json',
            {
              CardInfo: {
                employeeNo,
                cardNo: user.cardCode,
                cardType: 'normalCard',
              },
            },
          );
          pushedCards += 1;
        }
      } catch (error) {
        errors.push(
          `${employeeNo}: ${
            error instanceof Error ? error.message : 'Khong the day user len may.'
          }`,
        );
      }
    }

    return {
      connectorKey: this.key,
      supported: true,
      action: 'pushUsers',
      message:
        errors.length > 0
          ? 'Da goi Hikvision ISAPI de day user, nhung co mot so ban ghi bi loi.'
          : 'Da day user len Hikvision bang ISAPI.',
      metadata: {
        requestedUsers: users.length,
        pushedUsers,
        pushedCards,
        failedUsers: errors.length,
        errors: errors.slice(0, 20),
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
    const employeeNo =
      payload.machineUserId ||
      payload.appAttendanceCode ||
      payload.machineCode ||
      payload.personId;

    if (!employeeNo) {
      throw new BadRequestException(
        'Khong the tao enrollment vi thieu machine user id / attendance code.',
      );
    }

    if (payload.enrollmentType === 'CARD') {
      if (!payload.cardCode) {
        return {
          connectorKey: this.key,
          supported: false,
          action: 'createEnrollment',
          message:
            'Enrollment the can cardCode. He thong da san sang schema/mapping, nhung payload tao the hien tai chua co cardCode.',
          metadata: {
            machineCode: machine.code,
            employeeNo,
          },
        };
      }

      await this.requestJson(
        machine,
        'PUT',
        '/ISAPI/AccessControl/CardInfo/SetUp?format=json',
        {
          CardInfo: {
            employeeNo,
            cardNo: payload.cardCode,
            cardType: 'normalCard',
          },
        },
      );

      return {
        connectorKey: this.key,
        supported: true,
        action: 'createEnrollment',
        message: 'Da tao enrollment the tren Hikvision.',
        metadata: {
          enrollmentType: payload.enrollmentType,
          employeeNo,
          cardCode: payload.cardCode,
        },
      };
    }

    if (payload.enrollmentType === 'FACE') {
      if (!payload.faceImageUrl && !payload.faceImageBase64) {
        return {
          connectorKey: this.key,
          supported: false,
          action: 'createEnrollment',
          message:
            'Enrollment khuon mat can faceImageUrl hoac faceImageBase64. He thong da co schema biometric asset, nhung payload tao face hien tai chua day du asset de day len may.',
          metadata: {
            machineCode: machine.code,
            employeeNo,
          },
        };
      }

      await this.requestJson(
        machine,
        'PUT',
        '/ISAPI/Intelligent/FDLib/FDSetUp?format=json',
        {
          FaceDataRecord: {
            faceLibType: 'blackFD',
            FDID: machine.deviceIdentifier || '1',
            FPID: employeeNo,
            name: payload.displayName || employeeNo,
            faceURL: payload.faceImageUrl,
            faceData: payload.faceImageBase64,
          },
        },
      );

      return {
        connectorKey: this.key,
        supported: true,
        action: 'createEnrollment',
        message: 'Da day enrollment khuon mat len Hikvision.',
        metadata: {
          enrollmentType: payload.enrollmentType,
          employeeNo,
          fdid: machine.deviceIdentifier || '1',
        },
      };
    }

    return {
      connectorKey: this.key,
      supported: false,
      action: 'createEnrollment',
      message:
        'Connector Hikvision hien chua day fingerprint template. Phan nay can them luong template/SDK rieng theo model may.',
      metadata: {
        machineCode: machine.code,
        employeeNo,
        enrollmentType: payload.enrollmentType,
      },
    };
  }

  private async requestJson(
    machine: AttendanceDeviceMachineRuntime,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    payload?: HikvisionJson,
  ) {
    const url = this.buildUrl(machine, path);
    const username = String(machine.username || '').trim();
    const password = String(machine.password || '').trim();

    if (!machine.host || !machine.connectionPort) {
      throw new BadRequestException(
        'Machine Hikvision chua co host / connectionPort.',
      );
    }

    if (!username || !password) {
      throw new BadRequestException(
        'Machine Hikvision chua co username / password de goi ISAPI.',
      );
    }

    const headers = new Headers({
      Accept: 'application/json, text/plain, */*',
    });
    if (payload) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
    }

    const body = payload ? JSON.stringify(payload) : undefined;
    let response = await fetch(url, { method, headers, body });

    if (response.status === 401) {
      const challenge = response.headers.get('www-authenticate') || '';

      if (challenge.toLowerCase().includes('digest')) {
        headers.set(
          'Authorization',
          this.buildDigestAuthorization(challenge, method, url, username, password),
        );
      } else {
        headers.set('Authorization', this.buildBasicAuthorization(username, password));
      }

      response = await fetch(url, { method, headers, body });
    }

    if (!response.ok) {
      const rawText = await response.text();
      throw new BadRequestException(
        `Hikvision ISAPI ${method} ${path} loi ${response.status}: ${rawText.slice(
          0,
          500,
        )}`,
      );
    }

    const rawText = await response.text();
    if (!rawText) {
      return {};
    }

    try {
      return JSON.parse(rawText) as HikvisionJson;
    } catch {
      return {
        rawText,
      };
    }
  }

  private buildUrl(machine: AttendanceDeviceMachineRuntime, path: string) {
    const rawHost = String(machine.host || '').trim();
    const normalized = /^https?:\/\//i.test(rawHost)
      ? rawHost
      : `http://${rawHost}`;
    const url = new URL(normalized);

    if (machine.connectionPort) {
      url.port = String(machine.connectionPort);
    }

    const target = new URL(path, url);
    return target.toString();
  }

  private buildBasicAuthorization(username: string, password: string) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  private buildDigestAuthorization(
    challenge: string,
    method: string,
    rawUrl: string,
    username: string,
    password: string,
  ) {
    const digestHeader = challenge.replace(/^Digest\s+/i, '');
    const directives: Record<string, string> = {};

    for (const part of digestHeader.split(',')) {
      const [rawKey, ...rest] = part.trim().split('=');
      if (!rawKey || rest.length === 0) {
        continue;
      }

      const rawValue = rest.join('=').trim();
      directives[rawKey] = rawValue.replace(/^"|"$/g, '');
    }

    const realm = directives.realm || '';
    const nonce = directives.nonce || '';
    const opaque = directives.opaque || '';
    const algorithm = directives.algorithm || 'MD5';
    const qop = String(directives.qop || '')
      .split(',')
      .map((item) => item.trim())
      .find(Boolean);
    const cnonce = randomBytes(8).toString('hex');
    const nc = '00000001';
    const url = new URL(rawUrl);
    const uri = `${url.pathname}${url.search}`;

    const ha1Base = this.md5(`${username}:${realm}:${password}`);
    const ha1 =
      String(algorithm).toLowerCase() === 'md5-sess'
        ? this.md5(`${ha1Base}:${nonce}:${cnonce}`)
        : ha1Base;
    const ha2 = this.md5(`${method}:${uri}`);
    const response = qop
      ? this.md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : this.md5(`${ha1}:${nonce}:${ha2}`);

    const values = [
      `Digest username="${username}"`,
      `realm="${realm}"`,
      `nonce="${nonce}"`,
      `uri="${uri}"`,
      `response="${response}"`,
      `algorithm=${algorithm}`,
    ];

    if (opaque) {
      values.push(`opaque="${opaque}"`);
    }

    if (qop) {
      values.push(`qop=${qop}`);
      values.push(`nc=${nc}`);
      values.push(`cnonce="${cnonce}"`);
    }

    return values.join(', ');
  }

  private md5(value: string) {
    return createHash('md5').update(value).digest('hex');
  }

  private resolveEmployeeNo(user: AttendanceDeviceUserPayload) {
    return String(
      user.machineUserId ||
        user.machineCode ||
        user.appAttendanceCode ||
        user.personId ||
        '',
    ).trim();
  }

  private resolveVerificationMethod(eventInfo: HikvisionJson) {
    const rawMode = String(
      eventInfo.currentVerifyMode ||
        eventInfo.verifyMode ||
        eventInfo.mask ||
        '',
    )
      .trim()
      .toUpperCase();

    if (rawMode.includes('FACE') || rawMode === '7' || rawMode === '15') {
      return 'FACE' as const;
    }

    if (rawMode.includes('FINGER') || rawMode === '2') {
      return 'FINGERPRINT' as const;
    }

    return 'CARD' as const;
  }

  private resolveEventType(eventInfo: HikvisionJson) {
    const minor = String(eventInfo.minor || '')
      .trim()
      .toUpperCase();
    const status = String(
      eventInfo.inAndOutStatus || eventInfo.status || '',
    )
      .trim()
      .toUpperCase();

    if (
      minor.includes('OUT') ||
      status.includes('OUT') ||
      ['2', 'EXIT'].includes(status)
    ) {
      return 'CHECK_OUT' as const;
    }

    return 'CHECK_IN' as const;
  }

  private readMatches(block: HikvisionJson, key: string) {
    const direct = block[key];
    if (Array.isArray(direct)) {
      return direct as HikvisionJson[];
    }

    if (
      direct &&
      typeof direct === 'object' &&
      Array.isArray((direct as { MatchElement?: unknown[] }).MatchElement)
    ) {
      return ((direct as { MatchElement: unknown[] }).MatchElement ||
        []) as HikvisionJson[];
    }

    return [];
  }

  private readPath(
    source: HikvisionJson,
    path: string[],
  ): string | number | undefined {
    let cursor: unknown = source;
    for (const key of path) {
      if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
        return undefined;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }

    if (typeof cursor === 'string' || typeof cursor === 'number') {
      return cursor;
    }

    return undefined;
  }
}
