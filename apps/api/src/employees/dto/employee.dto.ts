import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class EmployeeListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  canChooseDeliveryAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeDeliveryTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  dietaryPreferences?: string[];
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
