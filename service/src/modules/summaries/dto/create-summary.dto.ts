import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateSummaryDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000) // 摘要内容最大长度，约200 tokens
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  triggerReason?: string; // 触发原因：消息数量超限或token超限
}
