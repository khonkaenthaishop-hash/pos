import {
  IsNumber, IsOptional, IsString, IsUUID, Min, IsNotEmpty,
} from 'class-validator';

export class AdjustDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  physicalCount: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
