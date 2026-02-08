import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatarAttachmentId?: string;
}
