import {
  IsArray, IsBoolean, IsEnum, IsNumber, IsOptional,
  IsString, IsUUID, Min, ValidateNested, IsNotEmpty, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../order.entity';

export class OrderItemDto {
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
  @Min(0, { message: 'ราคาต่อหน่วยต้องไม่ติดลบ' })
  unitPrice: number;

  @IsNumber()
  @Min(1, { message: 'จำนวนต้องอย่างน้อย 1' })
  @Max(9999, { message: 'จำนวนมากเกินไป' })
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'ส่วนลดรายการต้องไม่ติดลบ' })
  itemDiscount?: number;

  @IsOptional()
  @IsBoolean()
  isQuickItem?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePosOrderDto {
  @IsArray({ message: 'items ต้องเป็น array' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'ส่วนลดต้องไม่ติดลบ' })
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @IsOptional()
  @IsBoolean()
  includeVat?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  isDebt?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debtAmount?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  slipUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
