import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('characters')
@UseGuards(AuthGuard)
export class CharactersController {
  constructor(@Inject(CharactersService) private readonly charactersService: CharactersService) {}

  @Post()
  async create(
    @Req() request: Request,
    @Body(ValidationPipe) body: CreateCharacterDto,
  ) {
    const result = await this.charactersService.createCharacter(request, body);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Get()
  async list(
    @Req() request: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
    @Query('favorites') favorites?: string,
  ) {
    const result = await this.charactersService.listCharacters(request, {
      limit,
      cursor,
      search,
      favorites,
    });
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Post(':id/favorite')
  async toggleFavorite(@Req() request: Request, @Param('id') id: string) {
    const result = await this.charactersService.toggleFavorite(request, id);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Get(':id')
  async get(@Req() request: Request, @Param('id') id: string) {
    const result = await this.charactersService.getCharacter(request, id);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }
}
