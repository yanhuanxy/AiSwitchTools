import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateChatTaskDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  clientMessageId!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  attachmentIds?: string[];

  @IsOptional()
  @IsString()
  replyLength?: string;
}
