import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { LicenseService } from './license.service';

class LicenseStatusQueryDto {
  @IsOptional()
  @IsString()
  planCode?: string;
}

class LicenseAccessDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

class ActivateLicenseDto {
  @IsString()
  @MinLength(1)
  unlockCode!: string;

  @IsString()
  @MinLength(1)
  accessToken!: string;
}

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  @Public()
  getStatus(@Query() query: LicenseStatusQueryDto) {
    return this.licenseService.getStatus(
      this.licenseService.parseRequestedPlanCode(query.planCode),
    );
  }

  @Post('access')
  @Public()
  @HttpCode(200)
  async openActivation(@Body() body: LicenseAccessDto) {
    this.licenseService.assertActivationPassword(body.password);

    return {
      unlocked: true,
      accessToken: await this.licenseService.createActivationAccessToken(),
    };
  }

  @Post('activate')
  @Public()
  @HttpCode(200)
  async activate(@Body() body: ActivateLicenseDto) {
    await this.licenseService.assertActivationAccessToken(body.accessToken);
    return this.licenseService.activate(body.unlockCode);
  }
}
