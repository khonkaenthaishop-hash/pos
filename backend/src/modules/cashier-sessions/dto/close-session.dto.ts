import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseSessionDto {
  @IsNumber()
  @Min(0)
  closingAmount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
