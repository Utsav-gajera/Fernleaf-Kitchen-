import { IsArray, IsString } from 'class-validator';

export class UpdateCompanyMenuVisibilityDto {
  @IsArray()
  @IsString({ each: true })
  hiddenCategoryIds!: string[];

  @IsArray()
  @IsString({ each: true })
  hiddenDishIds!: string[];
}
