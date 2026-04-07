import { IsString } from 'class-validator';
import { IsOptional } from 'class-validator';

export class RequestOtpDto {
  @IsOptional()
  @IsString()
  databaseKey?: string;

  @IsString()
  identifier!: string;

  @IsString()
  password!: string;
}
