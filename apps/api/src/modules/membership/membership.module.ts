import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}
