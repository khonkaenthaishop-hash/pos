import {
  IsArray, IsNumber, IsOptional, IsString, IsUUID,
  IsBoolean, Min, ValidateNested, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HeldCartItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsNotEmpty()
  @IsString()
  productNameTh: string;

  @IsOptional()
  @IsString()
  productNameZh?: string;

  @IsOptional()
  @IsString()
  productNameEn?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  itemDiscount?: number;

  @IsOptional()
  @IsBoolean()
  isQuickItem?: boolean;

  @IsOptional()
  @IsString()
  pickLocation?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class HoldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeldCartItemDto)
  cart: HeldCartItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
