import {
  Body,
  Controller,
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
  CreateBirthdayTemplateDto,
  UpdateBirthdayTemplateDto,
  UpdateEmailConfigDto,
  UpdateGeneralSettingDto,
  UpdateSmsConfigDto,
  UpdateZaloConfigDto,
} from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('sms')
  @Permissions('settings.view')
  getSmsConfig(@Query('branchId') branchId?: string) {
    return this.settingsService.getSmsConfig(branchId);
  }

  @Patch('sms')
  @Permissions('settings.update')
  updateSmsConfig(
    @Body() dto: UpdateSmsConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateSmsConfig(dto, user);
  }

  @Get('email')
  @Permissions('settings.view')
  getEmailConfig(@Query('branchId') branchId?: string) {
    return this.settingsService.getEmailConfig(branchId);
  }

  @Patch('email')
  @Permissions('settings.update')
  updateEmailConfig(
    @Body() dto: UpdateEmailConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateEmailConfig(dto, user);
  }

  @Get('zalo')
  @Permissions('settings.view')
  getZaloConfig(@Query('branchId') branchId?: string) {
    return this.settingsService.getZaloConfig(branchId);
  }

  @Patch('zalo')
  @Permissions('settings.update')
  updateZaloConfig(
    @Body() dto: UpdateZaloConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateZaloConfig(dto, user);
  }

  @Get('birthday-template')
  @Permissions('settings.view')
  listBirthdayTemplates(@Query() query: QueryDto) {
    return this.settingsService.listBirthdayTemplates(query);
  }

  @Post('birthday-template')
  @Permissions('settings.create')
  createBirthdayTemplate(
    @Body() dto: CreateBirthdayTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.createBirthdayTemplate(dto, user);
  }

  @Patch('birthday-template/:id')
  @Permissions('settings.update')
  updateBirthdayTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateBirthdayTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateBirthdayTemplate(id, dto, user);
  }

  @Get('general')
  @Permissions('settings.view')
  getGeneralSetting() {
    return this.settingsService.getGeneralSetting();
  }

  @Patch('general')
  @Permissions('settings.update')
  updateGeneralSetting(
    @Body() dto: UpdateGeneralSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateGeneralSetting(dto, user);
  }

  @Get('system-printers')
  @Permissions('settings.view')
  listSystemPrinters() {
    return this.settingsService.listSystemPrinters();
  }

  @Get('system-printers/:printerName/paper-sizes')
  @Permissions('settings.view')
  listPrinterPaperSizes(@Param('printerName') printerName: string) {
    return this.settingsService.listPrinterPaperSizes(
      decodeURIComponent(printerName),
    );
  }

  @Get(':settingKey')
  @Permissions('settings.view')
  getScopedJsonSetting(
    @Param('settingKey') settingKey: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.settingsService.getScopedJsonSetting(settingKey, branchId);
  }

  @Patch(':settingKey')
  @Permissions('settings.update')
  updateScopedJsonSetting(
    @Param('settingKey') settingKey: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settingsService.updateScopedJsonSetting(settingKey, dto, user);
  }
}
