import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import {
  AttendanceMachineMaintenanceDto,
  CreateAttendanceMachineDto,
  CreateBranchDto,
  CreateRoleDto,
  CreateStaffAttendanceEventDto,
  CreateTenantDatabaseDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateAttendanceMachineDto,
  UpdateBranchDto,
  UpdateRoleDto,
  UpdateStaffAttendanceEventDto,
  UpdateTenantDatabaseDto,
  UpdateUserDto,
} from './system.dto';
import { SystemService } from './system.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('branches')
  @Permissions('branches.view')
  listBranches(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.systemService.listBranches(query, user);
  }

  @Post('branches')
  @Permissions('branches.create')
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.systemService.createBranch(dto, user);
  }

  @Get('branches/:id')
  @Permissions('branches.view')
  getBranch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.getBranch(id, user);
  }

  @Patch('branches/:id')
  @Permissions('branches.update')
  updateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateBranch(id, dto, user);
  }

  @Delete('branches/:id')
  @Permissions('branches.delete')
  removeBranch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.removeBranch(id, user);
  }

  @Get('roles')
  @Permissions('roles.view')
  listRoles(@Query() query: QueryDto) {
    return this.systemService.listRoles(query);
  }

  @Post('roles')
  @Permissions('roles.create')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthUser) {
    return this.systemService.createRole(dto, user);
  }

  @Get('roles/:id')
  @Permissions('roles.view')
  getRole(@Param('id') id: string) {
    return this.systemService.getRole(id);
  }

  @Patch('roles/:id')
  @Permissions('roles.update')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateRole(id, dto, user);
  }

  @Delete('roles/:id')
  @Permissions('roles.delete')
  removeRole(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.removeRole(id, user);
  }

  @Get('users')
  @Permissions('users.view')
  listUsers(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.systemService.listUsers(query, user);
  }

  @Get('users/:id')
  @Permissions('users.view')
  getUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.getUser(id, user);
  }

  @Get('tenant-databases')
  @Permissions('tenant-databases.view')
  listTenantDatabases(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.systemService.listTenantDatabases(query, user);
  }

  @Post('tenant-databases')
  @Permissions('tenant-databases.create')
  createTenantDatabase(
    @Body() dto: CreateTenantDatabaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.createTenantDatabase(dto, user);
  }

  @Patch('tenant-databases/:id')
  @Permissions('tenant-databases.update')
  updateTenantDatabase(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDatabaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateTenantDatabase(id, dto, user);
  }

  @Delete('tenant-databases/:id')
  @Permissions('tenant-databases.delete')
  removeTenantDatabase(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.removeTenantDatabase(id, user);
  }

  @Post('users')
  @Permissions('users.create')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.systemService.createUser(dto, user);
  }

  @Patch('users/:id')
  @Permissions('users.update')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateUser(id, dto, user);
  }

  @Post('users/:id/reset-password')
  @Permissions('users.update')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.resetPassword(id, dto, user);
  }

  @Delete('users/:id')
  @Permissions('users.delete')
  removeUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.removeUser(id, user);
  }

  @Get('attendance-machines')
  @Permissions('attendance-machines.view')
  listAttendanceMachines(
    @Query() query: QueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.listAttendanceMachines(query, user);
  }

  @Post('attendance-machines')
  @Permissions('attendance-machines.create')
  createAttendanceMachine(
    @Body() dto: CreateAttendanceMachineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.createAttendanceMachine(dto, user);
  }

  @Get('attendance-machines/:id')
  @Permissions('attendance-machines.view')
  getAttendanceMachine(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.systemService.getAttendanceMachine(id, user);
  }

  @Patch('attendance-machines/:id')
  @Permissions('attendance-machines.update')
  updateAttendanceMachine(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceMachineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateAttendanceMachine(id, dto, user);
  }

  @Post('attendance-machines/:id/maintenance')
  @Permissions('attendance-machines.update')
  maintainAttendanceMachine(
    @Param('id') id: string,
    @Body() dto: AttendanceMachineMaintenanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.maintainAttendanceMachine(id, dto, user);
  }

  @Delete('attendance-machines/:id')
  @Permissions('attendance-machines.delete')
  removeAttendanceMachine(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.removeAttendanceMachine(id, user);
  }

  @Get('staff-attendance-events')
  @Permissions('staff-attendance-events.view')
  listStaffAttendanceEvents(
    @Query() query: QueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.listStaffAttendanceEvents(query, user);
  }

  @Get('staff-attendance-events/:id')
  @Permissions('staff-attendance-events.view')
  getStaffAttendanceEvent(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.getStaffAttendanceEvent(id, user);
  }

  @Post('staff-attendance-events')
  @Permissions('staff-attendance-events.create')
  createStaffAttendanceEvent(
    @Body() dto: CreateStaffAttendanceEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.createStaffAttendanceEvent(dto, user);
  }

  @Patch('staff-attendance-events/:id')
  @Permissions('staff-attendance-events.update')
  updateStaffAttendanceEvent(
    @Param('id') id: string,
    @Body() dto: UpdateStaffAttendanceEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.updateStaffAttendanceEvent(id, dto, user);
  }

  @Delete('staff-attendance-events/:id')
  @Permissions('staff-attendance-events.delete')
  removeStaffAttendanceEvent(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.systemService.removeStaffAttendanceEvent(id, user);
  }
}
