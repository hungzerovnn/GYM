import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
