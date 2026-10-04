import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DeliverDropDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Matches(/^(?:https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i, {
    message: 'photoUrl must be an HTTP image URL or a JPEG, PNG, or WebP image.',
  })
  @MaxLength(3_000_000)
  photoUrl?: string;
}
