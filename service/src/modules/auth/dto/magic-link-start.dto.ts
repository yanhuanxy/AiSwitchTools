import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class MagicLinkStartDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}
