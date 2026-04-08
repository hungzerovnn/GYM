import { Module } from '@nestjs/common';
import { AttendanceDeviceRegistry } from './attendance-device.registry';
import { AttendanceDevicesService } from './attendance-devices.service';
import { GenericExportAttendanceConnector } from './connectors/generic-export.connector';
import { HikvisionIsapiAttendanceConnector } from './connectors/hikvision-isapi.connector';
import { ZkPullTcpAttendanceConnector } from './connectors/zk-pull-tcp.connector';

@Module({
  providers: [
    AttendanceDevicesService,
    AttendanceDeviceRegistry,
    GenericExportAttendanceConnector,
    HikvisionIsapiAttendanceConnector,
    ZkPullTcpAttendanceConnector,
  ],
  exports: [
    AttendanceDevicesService,
    AttendanceDeviceRegistry,
    GenericExportAttendanceConnector,
    HikvisionIsapiAttendanceConnector,
    ZkPullTcpAttendanceConnector,
  ],
})
export class AttendanceDevicesModule {}
