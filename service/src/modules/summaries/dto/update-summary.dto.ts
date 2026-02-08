import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateSummaryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000) // 摘要内容最大长度，约200 tokens
  content!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  updateReason?: string; // 更新原因
}
