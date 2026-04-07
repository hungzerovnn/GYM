import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard.view')
  summary(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.dashboardService.summary(query, user);
  }

  @Get('notifications')
  @Permissions('dashboard.view')
  notifications(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.dashboardService.notifications(query, user);
  }

  @Patch('notifications/:id/read')
  @Permissions('dashboard.view')
  markNotificationRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dashboardService.markNotificationRead(id, user);
  }
}
