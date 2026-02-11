import { IsArray, IsString } from 'class-validator';

export class BatchOperationDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
