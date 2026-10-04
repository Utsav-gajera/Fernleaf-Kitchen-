import { Transform, Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderOptionSelectionDto {
  @IsString()
  @IsNotEmpty()
  optionGroupId!: string;

  @IsString()
  @IsNotEmpty()
  optionId!: string;
}

export class OrderCombinationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderOptionSelectionDto)
  selections!: OrderOptionSelectionDto[];
}

export class OrderLineDto {
  @IsString()
  @IsNotEmpty()
  dishId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderCombinationDto)
  combinations!: OrderCombinationDto[];
}

export class OrderAddressDto {
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  packaging?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @IsOptional()
  @IsBoolean()
  place = false;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  packaging?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines?: OrderLineDto[];
}

export class CorrectOrderTotalDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  correctedTotalMinor!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class OrderListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsDateString()
  deliveryFrom?: string;

  @IsOptional()
  @IsDateString()
  deliveryTo?: string;

  @IsOptional()
  @IsString()
  @IsEnum(OrderStatus)
  status?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  invoiced?: boolean;
}
