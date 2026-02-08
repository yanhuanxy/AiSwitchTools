import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthProvider } from './auth.provider';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AuthProvider, AuthGuard],
  exports: [AuthService, AuthRepository, AuthProvider, AuthGuard],
})
export class AuthModule {}
