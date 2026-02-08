import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";
import { SafetyRepository } from "./safety.repository";
import { SafetyProvider } from "./safety.provider";

@Module({
  imports: [ConfigModule],
  controllers: [SafetyController],
  providers: [SafetyService, SafetyRepository, SafetyProvider],
  exports: [SafetyService, SafetyRepository, SafetyProvider]
})
export class SafetyModule {}
