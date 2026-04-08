import { Injectable } from '@nestjs/common';
import { GenericExportAttendanceConnector } from './connectors/generic-export.connector';
import { HikvisionIsapiAttendanceConnector } from './connectors/hikvision-isapi.connector';
import { ZkPullTcpAttendanceConnector } from './connectors/zk-pull-tcp.connector';
import {
  AttendanceDeviceConnector,
  AttendanceDeviceMachineRuntime,
} from './attendance-device.types';

@Injectable()
export class AttendanceDeviceRegistry {
  private readonly connectors: AttendanceDeviceConnector[];

  constructor(
    private readonly genericExportConnector: GenericExportAttendanceConnector,
    private readonly hikvisionIsapiConnector: HikvisionIsapiAttendanceConnector,
    private readonly zkPullTcpConnector: ZkPullTcpAttendanceConnector,
  ) {
    this.connectors = [
      this.zkPullTcpConnector,
      this.hikvisionIsapiConnector,
      this.genericExportConnector,
    ];
  }

  listConnectors() {
    return this.connectors.map((connector) => ({
      key: connector.key,
      displayName: connector.displayName,
      vendor: connector.vendor,
    }));
  }

  resolveConnector(
    machine: AttendanceDeviceMachineRuntime,
  ): AttendanceDeviceConnector {
    return (
      this.connectors.find((connector) => connector.supports(machine)) ||
      this.genericExportConnector
    );
  }
}
