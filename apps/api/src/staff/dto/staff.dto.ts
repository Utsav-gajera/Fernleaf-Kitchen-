import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { StaffRole } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(StaffRole)
  role!: StaffRole;
}

export class UpdateStaffRoleDto {
  @IsEnum(StaffRole)
  role!: StaffRole;
}

export class UpdateStaffStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
