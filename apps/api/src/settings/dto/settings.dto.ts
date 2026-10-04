import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  kitchenTimeZone!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  cutOffTime!: string;

  @IsInt()
  @Min(0)
  @Max(31)
  cutOffWorkingDays!: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  kitchenReadyBufferMinutes!: number;

  @IsBoolean()
  mon!: boolean;
  @IsBoolean()
  tue!: boolean;
  @IsBoolean()
  wed!: boolean;
  @IsBoolean()
  thu!: boolean;
  @IsBoolean()
  fri!: boolean;
  @IsBoolean()
  sat!: boolean;
  @IsBoolean()
  sun!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kitchenHolidays?: string[];
}
