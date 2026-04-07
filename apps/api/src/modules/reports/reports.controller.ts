import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import { getDetailedReportPermissionCode } from '../permissions/report-permission-catalog';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private async respond(
    title: string,
    format: string | undefined,
    payload: { summary: unknown; rows: Record<string, unknown>[] },
    user: AuthUser,
    module: string,
    response: Response,
  ) {
    if (!format) {
      return response.json(payload);
    }

    const buffer = await this.reportsService.export(
      title,
      format,
      payload.rows,
      user,
      module,
    );
    const mime =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : format === 'pdf'
          ? 'application/pdf'
          : 'text/csv';

    response.setHeader('Content-Type', mime);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=${title}.${format}`,
    );
    response.send(buffer);
  }

  @Get('kpi')
  @Permissions(getDetailedReportPermissionCode('kpi'))
  async kpi(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.kpi(query, user);
    return this.respond(
      'kpi-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('lead')
  @Permissions(getDetailedReportPermissionCode('lead'))
  async lead(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.lead(query, user);
    return this.respond(
      'lead-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('branch-revenue')
  @Permissions(getDetailedReportPermissionCode('branch-revenue'))
  async branchRevenue(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.branchRevenue(query, user);
    return this.respond(
      'branch-revenue-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('contract-remain')
  @Permissions(getDetailedReportPermissionCode('contract-remain'))
  async contractRemain(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.contractRemain(query, user);
    return this.respond(
      'contract-remain-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('payment')
  @Permissions(getDetailedReportPermissionCode('payment'))
  async payment(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.payment(query, user);
    return this.respond(
      'payment-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('deposit')
  @Permissions(getDetailedReportPermissionCode('deposit'))
  async deposit(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.deposit(query, user);
    return this.respond(
      'deposit-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('trainer-performance')
  @Permissions(getDetailedReportPermissionCode('trainer-performance'))
  async trainerPerformance(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.trainerPerformance(query, user);
    return this.respond(
      'trainer-performance-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('birthday')
  @Permissions(getDetailedReportPermissionCode('birthday'))
  async birthday(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.birthday(query, user);
    return this.respond(
      'birthday-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('follow-up')
  @Permissions(getDetailedReportPermissionCode('follow-up'))
  async followUp(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.followUp(query, user);
    return this.respond(
      'follow-up-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('checkin')
  @Permissions(getDetailedReportPermissionCode('checkin'))
  async checkin(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.checkin(query, user);
    return this.respond(
      'checkin-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('pt-training')
  @Permissions(getDetailedReportPermissionCode('pt-training'))
  async ptTraining(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.ptTraining(query, user);
    return this.respond(
      'pt-training-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('staff-attendance')
  @Permissions(getDetailedReportPermissionCode('staff-attendance'))
  async staffAttendance(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.staffAttendance(query, user);
    return this.respond(
      'staff-attendance-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('class-attendance')
  @Permissions(getDetailedReportPermissionCode('class-attendance'))
  async classAttendance(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.classAttendance(query, user);
    return this.respond(
      'class-attendance-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('allocation')
  @Permissions(getDetailedReportPermissionCode('allocation'))
  async allocation(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.allocation(query, user);
    return this.respond(
      'allocation-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('sales-summary')
  @Permissions(getDetailedReportPermissionCode('sales-summary'))
  async salesSummary(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.salesSummary(query, user);
    return this.respond(
      'sales-summary-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('debt')
  @Permissions(getDetailedReportPermissionCode('debt'))
  async debt(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.debt(query, user);
    return this.respond(
      'debt-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('branch-summary')
  @Permissions(getDetailedReportPermissionCode('branch-summary'))
  async branchSummary(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.branchSummary(query, user);
    return this.respond(
      'branch-summary-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('package-progress')
  @Permissions(getDetailedReportPermissionCode('package-progress'))
  async packageProgress(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.packageProgress(query, user);
    return this.respond(
      'package-progress-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('card-revenue')
  @Permissions(getDetailedReportPermissionCode('card-revenue'))
  async cardRevenue(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.cardRevenue(query, user);
    return this.respond(
      'card-revenue-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('staff-review')
  @Permissions(getDetailedReportPermissionCode('staff-review'))
  async staffReview(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.staffReview(query, user);
    return this.respond(
      'staff-review-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }

  @Get('lead-status')
  @Permissions(getDetailedReportPermissionCode('lead-status'))
  async leadStatus(
    @Query() query: QueryDto,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const payload = await this.reportsService.leadStatus(query, user);
    return this.respond(
      'lead-status-report',
      format,
      payload,
      user,
      'reports',
      response,
    );
  }
}
