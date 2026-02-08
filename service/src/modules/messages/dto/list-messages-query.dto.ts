import { IsOptional, IsString } from 'class-validator';

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
