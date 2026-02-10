import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import { AppModule } from "./app.module";
import { ObservabilityService } from "./modules/observability/observability.service";
import { JwtExceptionFilter } from "./common/filters/jwt-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new JwtExceptionFilter());
  const observabilityService = app.get(ObservabilityService);
  if (!observabilityService) {
    console.error("ObservabilityService not found!");
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (observabilityService) {
      try {
        const traceId = observabilityService.resolveTraceId(
          (req as { headers: Record<string, unknown> }).headers["x-trace-id"]
        );
        (req as { headers: Record<string, unknown> }).headers["x-trace-id"] = traceId;
        res.setHeader("x-trace-id", traceId);
      } catch (e) {
        console.error("Failed to resolve traceId", e);
      }
    }
    next();
  });
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  const port = process.env.PORT ? Number(process.env.PORT) : 3100;
  await app.listen(port);
}

bootstrap();
