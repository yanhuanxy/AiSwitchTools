import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TasksController } from './tasks.controller';
import { TasksProvider } from './tasks.provider';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, TasksProvider],
  exports: [TasksService, TasksRepository, TasksProvider],
})
export class TasksModule {}
