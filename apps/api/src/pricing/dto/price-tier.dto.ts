import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePriceTierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  derivedFromTierId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  multiplier?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  markupPercent?: number | null;
}

export class UpdatePriceTierDto extends PartialType(CreatePriceTierDto) {}
