import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  databaseKey?: string;

  @IsString()
  identifier!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  otpCode?: string;

  @IsOptional()
  @IsString()
  otpChallengeId?: string;
}
