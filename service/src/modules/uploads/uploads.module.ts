import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { UploadsController } from "./uploads.controller";
import { UploadsRepository } from "./uploads.repository";
import { UploadsProvider } from "./uploads.provider";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsRepository, UploadsProvider],
  exports: [UploadsService, UploadsRepository, UploadsProvider]
})
export class UploadsModule {}
