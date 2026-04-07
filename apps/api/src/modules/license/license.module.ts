import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
