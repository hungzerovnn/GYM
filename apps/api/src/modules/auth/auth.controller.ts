import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RequestOtpDto } from './dto/request-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('databases')
  @Public()
  listDatabases() {
    return this.authService.listLoginDatabases();
  }

  @Get('otp-config')
  @Public()
  getOtpConfig() {
    return this.authService.getPublicOtpConfig();
  }

  @Post('request-otp')
  @Public()
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.authService.requestOtp(dto, {
      ipAddress: req.headers['x-forwarded-for']?.toString() || (req as any).ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: req.headers['x-forwarded-for']?.toString() || (req as any).ip,
      userAgent: req.headers['user-agent'],
    });

    response.cookie('fitflow_refresh_token', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return result;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token =
      dto.refreshToken || (req as any).cookies?.fitflow_refresh_token;
    const result = await this.authService.refresh(token);

    response.cookie('fitflow_refresh_token', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('fitflow_refresh_token');
    return this.authService.logout(user);
  }
}
