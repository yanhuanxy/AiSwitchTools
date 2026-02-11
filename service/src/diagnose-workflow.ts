import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkflowService } from './modules/workflow/workflow.service';
import { PrismaService } from './prisma/prisma.service';

async function diagnose() {
  console.log('Starting Diagnostic Check...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    console.log('Application Context Created');

    const prismaService = app.get(PrismaService);
    console.log('PrismaService retrieved');
    
    if (!prismaService) {
      console.error('CRITICAL: PrismaService is undefined/null');
    } else {
      console.log('PrismaService is defined');
      
      // Check for workflow property safely
      if ('workflow' in prismaService) {
        console.log('SUCCESS: prisma.workflow exists');
      } else {
        console.error('CRITICAL: prisma.workflow is MISSING');
        console.log('Available keys on prismaService:', Object.keys(prismaService));
        // Also check prototype
        console.log('Available keys on prismaService prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(prismaService)));
      }
    }

    const workflowService = app.get(WorkflowService);
    console.log('WorkflowService retrieved');
    
    if (!workflowService) {
      console.error('CRITICAL: WorkflowService is undefined/null');
    } else {
       console.log('WorkflowService is defined');
       // Try to access the injected prisma
       const injectedPrisma = (workflowService as any).prisma;
       if (injectedPrisma === prismaService) {
         console.log('SUCCESS: WorkflowService has correct PrismaService instance');
       } else {
         console.error('CRITICAL: WorkflowService has INCORRECT PrismaService instance');
       }
    }

    await app.close();
    console.log('Diagnostic Check Completed');

  } catch (err) {
    console.error('Diagnostic Check Failed with Error:', err);
  }
}

diagnose();
