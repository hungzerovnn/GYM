import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
