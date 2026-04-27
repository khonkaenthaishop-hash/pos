import {
  IsOptional, IsString, IsDateString, IsBoolean,
} from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address711?: string;

  @IsOptional()
  @IsString()
  addressFamilyMart?: string;

  @IsOptional()
  @IsString()
  addressYamato?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsDateString()
  registerDate?: string;

  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @IsOptional()
  @IsString()
  facebookId?: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
