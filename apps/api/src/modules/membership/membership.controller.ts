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
  CheckInTrainingSessionDto,
  ConvertContractDto,
  CreateContractDto,
  CreateServiceDto,
  CreateServicePackageDto,
  CreateTrainerDto,
  CreateTrainingSessionDto,
  UpdateContractDto,
  UpdateServiceDto,
  UpdateServicePackageDto,
  UpdateTrainerDto,
  UpdateTrainingSessionDto,
} from './membership.dto';
import { MembershipService } from './membership.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('services')
  @Permissions('services.view')
  listServices(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.listServices(query, user);
  }

  @Get('services/:id')
  @Permissions('services.view')
  getService(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.getService(id, user);
  }

  @Post('services')
  @Permissions('services.create')
  createService(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.createService(dto, user);
  }

  @Patch('services/:id')
  @Permissions('services.update')
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.updateService(id, dto, user);
  }

  @Delete('services/:id')
  @Permissions('services.delete')
  removeService(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.removeService(id, user);
  }

  @Get('service-packages')
  @Permissions('service-packages.view')
  listServicePackages(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.listServicePackages(query, user);
  }

  @Get('service-packages/:id')
  @Permissions('service-packages.view')
  getServicePackage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.getServicePackage(id, user);
  }

  @Post('service-packages')
  @Permissions('service-packages.create')
  createServicePackage(
    @Body() dto: CreateServicePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.createServicePackage(dto, user);
  }

  @Patch('service-packages/:id')
  @Permissions('service-packages.update')
  updateServicePackage(
    @Param('id') id: string,
    @Body() dto: UpdateServicePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.updateServicePackage(id, dto, user);
  }

  @Delete('service-packages/:id')
  @Permissions('service-packages.delete')
  removeServicePackage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.removeServicePackage(id, user);
  }

  @Get('trainers')
  @Permissions('trainers.view')
  listTrainers(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.listTrainers(query, user);
  }

  @Get('trainers/:id')
  @Permissions('trainers.view')
  getTrainer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.getTrainer(id, user);
  }

  @Post('trainers')
  @Permissions('trainers.create')
  createTrainer(@Body() dto: CreateTrainerDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.createTrainer(dto, user);
  }

  @Patch('trainers/:id')
  @Permissions('trainers.update')
  updateTrainer(
    @Param('id') id: string,
    @Body() dto: UpdateTrainerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.updateTrainer(id, dto, user);
  }

  @Delete('trainers/:id')
  @Permissions('trainers.delete')
  removeTrainer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.removeTrainer(id, user);
  }

  @Get('contracts')
  @Permissions('contracts.view')
  listContracts(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.membershipService.listContracts(query, user);
  }

  @Get('contracts/:id')
  @Permissions('contracts.view')
  getContract(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.getContract(id, user);
  }

  @Post('contracts')
  @Permissions('contracts.create')
  createContract(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.createContract(dto, user);
  }

  @Patch('contracts/:id')
  @Permissions('contracts.update')
  updateContract(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.updateContract(id, dto, user);
  }

  @Delete('contracts/:id')
  @Permissions('contracts.delete')
  removeContract(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.removeContract(id, user);
  }

  @Post('contracts/:id/convert')
  @Permissions('contracts.update')
  convertContract(
    @Param('id') id: string,
    @Body() dto: ConvertContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.convertContract(id, dto, user);
  }

  @Get('training-sessions')
  @Permissions('training-sessions.view')
  listTrainingSessions(
    @Query() query: QueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.listTrainingSessions(query, user);
  }

  @Get('training-sessions/:id')
  @Permissions('training-sessions.view')
  getTrainingSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.membershipService.getTrainingSession(id, user);
  }

  @Post('training-sessions')
  @Permissions('training-sessions.create')
  createTrainingSession(
    @Body() dto: CreateTrainingSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.createTrainingSession(dto, user);
  }

  @Patch('training-sessions/:id')
  @Permissions('training-sessions.update')
  updateTrainingSession(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.updateTrainingSession(id, dto, user);
  }

  @Delete('training-sessions/:id')
  @Permissions('training-sessions.delete')
  removeTrainingSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.removeTrainingSession(id, user);
  }

  @Post('training-sessions/:id/check-in')
  @Permissions('training-sessions.update')
  checkInTrainingSession(
    @Param('id') id: string,
    @Body() dto: CheckInTrainingSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.checkInTrainingSession(id, dto, user);
  }
}
