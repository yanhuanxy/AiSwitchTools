import { IsString, IsOptional } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
