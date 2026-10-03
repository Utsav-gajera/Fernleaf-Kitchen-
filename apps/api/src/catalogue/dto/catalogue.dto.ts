import { DishTemperature } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DishListQueryDto {
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

export class DishCategoryAssignmentDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @IsOptional()
  @IsBoolean()
  isActive = true;
}

export class DishOptionGroupAssignmentDto {
  @IsString()
  @IsNotEmpty()
  optionGroupId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @IsOptional()
  @IsBoolean()
  isRequiredOverride?: boolean;
}

export class CreateDishDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsEnum(DishTemperature)
  temperature?: DishTemperature = DishTemperature.HOT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceMinor?: number;

  @IsOptional()
  @IsString()
  stationId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  dietaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  categoryAssignments?: DishCategoryAssignmentDto[];

  @IsOptional()
  @IsArray()
  optionGroups?: DishOptionGroupAssignmentDto[];
}

export class UpdateDishDto extends CreateDishDto {}

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceMinor?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  dietaryTagIds?: string[];
}

export class UpdateOptionDto extends CreateOptionDto {}

export class CreateOptionGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPortions?: boolean;

  @IsOptional()
  @IsArray()
  optionIds?: Array<{
    optionId: string;
    displayOrder?: number;
    extraChargeMinor?: number;
  }>;
}

export class UpdateOptionGroupDto extends CreateOptionGroupDto {}

export class CreateReferenceItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

export class UpdateCategoryDto extends CreateCategoryDto {}

export class CategoryDishAssignmentBodyDto {
  @IsString()
  @IsNotEmpty()
  dishId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @IsOptional()
  @IsBoolean()
  isActive = true;
}

export class OptionGroupOptionSyncDto {
  @IsArray()
  items!: Array<{
    optionId: string;
    displayOrder?: number;
    extraChargeMinor?: number;
  }>;
}
