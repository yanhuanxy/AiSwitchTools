import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { CharacterVersionsService } from './character-versions.service';
import { CreateCharacterVersionDto, UpdateCharacterVersionDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('character-versions')
@UseGuards(AuthGuard)
export class CharacterVersionsController {
  constructor(
    @Inject(CharacterVersionsService) private readonly characterVersionsService: CharacterVersionsService,
  ) {}

  @Put(':versionId')
  async update(
    @Req() request: Request,
    @Param('versionId') versionId: string,
    @Body(ValidationPipe) body: UpdateCharacterVersionDto,
  ) {
    const result = await this.characterVersionsService.updateDraft(request, versionId, body);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Post(':versionId/publish')
  async publish(@Req() request: Request, @Param('versionId') versionId: string) {
    const result = await this.characterVersionsService.publish(request, versionId);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }
}

@Controller('characters')
@UseGuards(AuthGuard)
export class CharacterVersionsByCharacterController {
  constructor(
    @Inject(CharacterVersionsService) private readonly characterVersionsService: CharacterVersionsService,
  ) {}

  @Post(':characterId/versions')
  async create(
    @Req() request: Request,
    @Param('characterId') characterId: string,
    @Body(ValidationPipe) body: CreateCharacterVersionDto,
  ) {
    const result = await this.characterVersionsService.createVersion(
      request,
      characterId,
      body,
    );
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Get(':characterId/versions')
  async list(
    @Req() request: Request,
    @Param('characterId') characterId: string,
  ) {
    const result = await this.characterVersionsService.listVersions(request, characterId);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }
}
