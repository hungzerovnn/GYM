import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AttendanceDevicesModule } from '../attendance-devices/attendance-devices.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [AuditLogsModule, AttendanceDevicesModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
