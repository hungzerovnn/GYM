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
  CreateCustomerDto,
  CreateCustomerGroupDto,
  CreateCustomerSourceDto,
  CreateLeadDto,
  CreateLeadLogDto,
  ToggleMemberPresenceDto,
  UpdateCustomerDto,
  UpdateCustomerGroupDto,
  UpdateCustomerSourceDto,
  UpdateLeadDto,
} from './crm.dto';
import { CrmService } from './crm.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('customer-groups')
  @Permissions('customer-groups.view')
  listCustomerGroups(@Query() query: QueryDto) {
    return this.crmService.listCustomerGroups(query);
  }

  @Get('customer-groups/:id')
  @Permissions('customer-groups.view')
  getCustomerGroup(@Param('id') id: string) {
    return this.crmService.getCustomerGroup(id);
  }

  @Post('customer-groups')
  @Permissions('customer-groups.create')
  createCustomerGroup(
    @Body() dto: CreateCustomerGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.createCustomerGroup(dto, user);
  }

  @Patch('customer-groups/:id')
  @Permissions('customer-groups.update')
  updateCustomerGroup(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.updateCustomerGroup(id, dto, user);
  }

  @Delete('customer-groups/:id')
  @Permissions('customer-groups.delete')
  removeCustomerGroup(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.removeCustomerGroup(id, user);
  }

  @Get('customer-sources')
  @Permissions('customer-sources.view')
  listCustomerSources(@Query() query: QueryDto) {
    return this.crmService.listCustomerSources(query);
  }

  @Get('customer-sources/:id')
  @Permissions('customer-sources.view')
  getCustomerSource(@Param('id') id: string) {
    return this.crmService.getCustomerSource(id);
  }

  @Post('customer-sources')
  @Permissions('customer-sources.create')
  createCustomerSource(
    @Body() dto: CreateCustomerSourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.createCustomerSource(dto, user);
  }

  @Patch('customer-sources/:id')
  @Permissions('customer-sources.update')
  updateCustomerSource(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerSourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.updateCustomerSource(id, dto, user);
  }

  @Delete('customer-sources/:id')
  @Permissions('customer-sources.delete')
  removeCustomerSource(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.removeCustomerSource(id, user);
  }

  @Get('lead-sources')
  @Permissions('leads.view')
  listLeadSources(@Query() query: QueryDto) {
    return this.crmService.listLeadSources(query);
  }

  @Get('customers')
  @Permissions('customers.view')
  listCustomers(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.crmService.listCustomers(query, user);
  }

  @Get('customers/:id')
  @Permissions('customers.view')
  getCustomer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.getCustomer(id, user);
  }

  @Get('customers/:id/timeline')
  @Permissions('customers.view')
  customerTimeline(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.customerTimeline(id, user);
  }

  @Post('customers')
  @Permissions('customers.create')
  createCustomer(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.createCustomer(dto, user);
  }

  @Patch('customers/:id')
  @Permissions('customers.update')
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.updateCustomer(id, dto, user);
  }

  @Delete('customers/:id')
  @Permissions('customers.delete')
  removeCustomer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.removeCustomer(id, user);
  }

  @Get('member-presence')
  @Permissions('member-presence.view')
  listMemberPresence(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.crmService.listMemberPresence(query, user);
  }

  @Get('member-presence/:id')
  @Permissions('member-presence.view')
  getMemberPresence(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.getMemberPresence(id, user);
  }

  @Post('member-presence/:id/toggle')
  @Permissions('member-presence.update')
  toggleMemberPresence(
    @Param('id') id: string,
    @Body() dto: ToggleMemberPresenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.toggleMemberPresence(id, dto, user);
  }

  @Get('leads')
  @Permissions('leads.view')
  listLeads(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.crmService.listLeads(query, user);
  }

  @Get('leads/:id')
  @Permissions('leads.view')
  getLead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.getLead(id, user);
  }

  @Post('leads')
  @Permissions('leads.create')
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthUser) {
    return this.crmService.createLead(dto, user);
  }

  @Patch('leads/:id')
  @Permissions('leads.update')
  updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.updateLead(id, dto, user);
  }

  @Delete('leads/:id')
  @Permissions('leads.delete')
  removeLead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.crmService.removeLead(id, user);
  }

  @Post('leads/:id/logs')
  @Permissions('leads.update')
  addLeadLog(
    @Param('id') id: string,
    @Body() dto: CreateLeadLogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crmService.addLeadLog(id, dto, user);
  }
}
