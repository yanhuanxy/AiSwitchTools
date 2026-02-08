import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  graphData: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
