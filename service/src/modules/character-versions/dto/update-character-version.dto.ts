import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCharacterVersionDto {
  @IsObject()
  @IsOptional()
  promptConfig?: unknown;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  knowledgeBaseId?: string;
}
