import { DishTemperature } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
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
  @IsNotEmpty()
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
  @ArrayUnique()
  @IsString({ each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  dietaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishCategoryAssignmentDto)
  categoryAssignments?: DishCategoryAssignmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishOptionGroupAssignmentDto)
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
  @ArrayUnique()
  @IsString({ each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  dietaryTagIds?: string[];
}

export class UpdateOptionDto extends CreateOptionDto {}

export class OptionGroupOptionItemDto {
  @IsString()
  @IsNotEmpty()
  optionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class CreateOptionGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionGroupOptionItemDto)
  optionIds?: OptionGroupOptionItemDto[];
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
  @ValidateNested({ each: true })
  @Type(() => OptionGroupOptionItemDto)
  items!: OptionGroupOptionItemDto[];
}
