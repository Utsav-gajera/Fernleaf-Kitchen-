import { ArrayNotEmpty, IsArray, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds!: string[];
}
