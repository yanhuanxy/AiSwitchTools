import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCharacterVersionDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsObject()
  promptConfig: unknown;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  knowledgeBaseId?: string;
}
