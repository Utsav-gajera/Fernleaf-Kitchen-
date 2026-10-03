import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CompanyListQueryDto {
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

export class CompanyDomainDto {
  @IsString()
  @IsNotEmpty()
  domain!: string;
}

export class CompanyAddressDto {
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

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CompanyHolidayDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  billingContactName?: string;

  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @IsOptional()
  @IsString()
  billingContactPhone?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  priceTierId?: string;

  @IsOptional()
  @IsString()
  defaultDeliveryTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryLeadMinutes?: number;

  @IsOptional()
  @IsString()
  defaultPackaging?: string;

  @IsOptional()
  @IsString()
  standingInstructions?: string;

  @IsOptional()
  @IsString()
  defaultDriverId?: string;

  @IsOptional()
  @IsBoolean()
  mon?: boolean;

  @IsOptional()
  @IsBoolean()
  tue?: boolean;

  @IsOptional()
  @IsBoolean()
  wed?: boolean;

  @IsOptional()
  @IsBoolean()
  thu?: boolean;

  @IsOptional()
  @IsBoolean()
  fri?: boolean;

  @IsOptional()
  @IsBoolean()
  sat?: boolean;

  @IsOptional()
  @IsBoolean()
  sun?: boolean;

  @IsOptional()
  @IsArray()
  domains?: string[];

  @IsOptional()
  @IsArray()
  addresses?: CompanyAddressDto[];

  @IsOptional()
  @IsArray()
  holidays?: CompanyHolidayDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class UpdateCompanyDefaultsDto {
  @IsOptional()
  @IsString()
  defaultDeliveryTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryLeadMinutes?: number;

  @IsOptional()
  @IsString()
  defaultPackaging?: string;

  @IsOptional()
  @IsString()
  standingInstructions?: string;
}

export class UpdateCompanyWorkingDaysDto {
  @IsOptional()
  @IsBoolean()
  mon?: boolean;

  @IsOptional()
  @IsBoolean()
  tue?: boolean;

  @IsOptional()
  @IsBoolean()
  wed?: boolean;

  @IsOptional()
  @IsBoolean()
  thu?: boolean;

  @IsOptional()
  @IsBoolean()
  fri?: boolean;

  @IsOptional()
  @IsBoolean()
  sat?: boolean;

  @IsOptional()
  @IsBoolean()
  sun?: boolean;
}
