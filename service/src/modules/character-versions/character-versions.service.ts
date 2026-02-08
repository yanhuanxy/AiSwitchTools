import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { ulid } from 'ulid';
import { CharacterVersionsRepository } from './character-versions.repository';
import { CreateCharacterVersionDto, UpdateCharacterVersionDto } from './dto';

type PromptConfig = {
  backgroundStory: string;
  personalityTags: string[];
  speakingStyle: string;
  fewShotExamples: Array<{ user: string; assistant: string }>;
  tabooAndBoundaries: string;
  safetyTightening?: Record<string, unknown>;
};

type CharacterVersionRecord = {
  id: string;
  characterId: string;
  version: number;
  status: string;
  promptConfigJson: string;
  createdAt: Date;
};

@Injectable()
export class CharacterVersionsService {
  constructor(
    @Inject(CharacterVersionsRepository) private readonly characterVersionsRepository: CharacterVersionsRepository,
  ) {}

  async createVersion(
    request: Request,
    characterId: string,
    body: CreateCharacterVersionDto,
  ) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!characterId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const character = await this.characterVersionsRepository.findCharacter({
      id: characterId,
      ownerUserId,
    });
    if (!character) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    const status = this.normalizeStatus(body.status);
    const promptConfig = this.validatePromptConfig(body.promptConfig);
    const latestVersion =
      await this.characterVersionsRepository.getLatestVersionNumber(characterId);
    const version = latestVersion + 1;
    const versionId = ulid();
    await this.characterVersionsRepository.createVersion({
      id: versionId,
      characterId,
      version,
      status,
      promptConfigJson: JSON.stringify(promptConfig),
      workflowId: body.workflowId,
      knowledgeBaseId: body.knowledgeBaseId,
    });
    return { versionId, version };
  }

  async listVersions(request: Request, characterId: string) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!characterId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const versions = await this.characterVersionsRepository.listVersions({
      characterId,
      ownerUserId,
    });
    return {
      items: versions.map((version: any) => ({
        id: version.id,
        characterId: version.characterId,
        version: version.version,
        status: version.status,
        promptConfig: this.parsePromptConfig(version.promptConfigJson),
        workflowId: version.workflowId,
        knowledgeBaseId: version.knowledgeBaseId,
        workflow: version.workflow,
        knowledgeBase: version.knowledgeBase,
        createdAt: version.createdAt.toISOString(),
      })),
    };
  }

  async updateDraft(
    request: Request,
    versionId: string,
    body: UpdateCharacterVersionDto,
  ) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!versionId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const version = await this.characterVersionsRepository.findVersionById({
      id: versionId,
      ownerUserId,
    });
    if (!version) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    if (version.status !== 'draft') {
      throw new BadRequestException('ONLY_DRAFT_CAN_BE_UPDATED');
    }

    const updateData: any = { id: versionId };
    if (body.promptConfig) {
      const promptConfig = this.validatePromptConfig(body.promptConfig);
      updateData.promptConfigJson = JSON.stringify(promptConfig);
    }
    if (body.workflowId !== undefined) updateData.workflowId = body.workflowId;
    if (body.knowledgeBaseId !== undefined) updateData.knowledgeBaseId = body.knowledgeBaseId;

    await this.characterVersionsRepository.updateVersion(updateData);
    return { success: true };
  }

  async publish(request: Request, versionId: string) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!versionId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const record = await this.characterVersionsRepository.findVersionById({
      id: versionId,
      ownerUserId,
    });
    if (!record) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    if (record.status !== 'draft') {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.characterVersionsRepository.publishVersion(record.id);
    return { versionId: record.id, version: record.version };
  }

  private getOwnerUserId(request: Request) {
    const userId = (request as { user?: { id?: string } }).user?.id;
    if (!userId) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    return userId;
  }

  private normalizeStatus(status?: string) {
    if (!status) {
      return 'draft' as const;
    }
    if (status !== 'draft' && status !== 'published') {
      throw new BadRequestException('INVALID_PARAMS');
    }
    return status;
  }

  private validatePromptConfig(raw: unknown): PromptConfig {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const data = raw as Partial<PromptConfig>;
    
    // Optional fields with defaults or checks
    const backgroundStory = typeof data.backgroundStory === 'string' ? data.backgroundStory : '';
    if (backgroundStory.length > 4000) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    const personalityTags = Array.isArray(data.personalityTags) ? data.personalityTags : [];
    if (personalityTags.length > 10) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    for (const tag of personalityTags) {
      if (typeof tag !== 'string') {
        throw new BadRequestException('INVALID_PARAMS');
      }
      if (tag.length > 50) {
        throw new BadRequestException('INVALID_PARAMS');
      }
    }

    const speakingStyle = typeof data.speakingStyle === 'string' ? data.speakingStyle : '';
    if (speakingStyle.length > 2000) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    const fewShotExamples = Array.isArray(data.fewShotExamples) ? data.fewShotExamples : [];
    if (fewShotExamples.length > 6) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    for (const example of fewShotExamples) {
      if (!example || typeof example !== 'object') {
        throw new BadRequestException('INVALID_PARAMS');
      }
      const cast = example as { user?: unknown; assistant?: unknown };
      if (typeof cast.user !== 'string' || typeof cast.assistant !== 'string') {
        throw new BadRequestException('INVALID_PARAMS');
      }
      if (cast.user.length > 2000 || cast.assistant.length > 2000) {
        throw new BadRequestException('INVALID_PARAMS');
      }
    }

    const tabooAndBoundaries = typeof data.tabooAndBoundaries === 'string' ? data.tabooAndBoundaries : '';
    if (tabooAndBoundaries.length > 2000) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    if (
      data.safetyTightening !== undefined &&
      (data.safetyTightening === null ||
        typeof data.safetyTightening !== 'object' ||
        Array.isArray(data.safetyTightening))
    ) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    return {
      backgroundStory,
      personalityTags,
      speakingStyle,
      fewShotExamples: fewShotExamples as Array<{
        user: string;
        assistant: string;
      }>,
      tabooAndBoundaries,
      safetyTightening: data.safetyTightening as
        | Record<string, unknown>
        | undefined,
    };
  }

  private parsePromptConfig(raw: string): PromptConfig {
    try {
      return this.validatePromptConfig(JSON.parse(raw));
    } catch {
      throw new BadRequestException('INVALID_PARAMS');
    }
  }
}
