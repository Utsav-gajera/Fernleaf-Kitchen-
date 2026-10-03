import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class DeliverDropDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  photoUrl?: string;
}
