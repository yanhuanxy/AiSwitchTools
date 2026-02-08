import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateWorkflowDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  graphData?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
