import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenSessionDto {
  @IsNumber()
  @Min(0)
  openingAmount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
