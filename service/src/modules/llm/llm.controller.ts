import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { LlmService } from './llm.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('llm')
@UseGuards(AuthGuard)
export class LlmController {
  constructor(@Inject(LlmService) private readonly llmService: LlmService) {}

  @Get('models')
  async getModels() {
    const result = await this.llmService.getAvailableModels();
    // Map to frontend expected format if needed (currently frontend expects array)
    // The requirement says "return { models: ... }"
    // But frontend might break. Let's return the object as requested.
    return result; 
  }

  @Get('models/reload')
  async reloadModels() {
    return this.llmService.reloadCache();
  }
}
