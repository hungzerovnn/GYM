import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Permissions('audit-logs.view')
  findAll(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.auditLogsService.findAll(query, user);
  }

  @Get(':id')
  @Permissions('audit-logs.view')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.auditLogsService.findOne(id, user);
  }
}
