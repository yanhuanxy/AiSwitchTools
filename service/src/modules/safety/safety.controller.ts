import { Controller, Inject } from '@nestjs/common';
import { SafetyService } from './safety.service';

@Controller('safety')
export class SafetyController {
  constructor(@Inject(SafetyService) private readonly safetyService: SafetyService) {}
}
