import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";

@Injectable()
export class UploadsProvider {
  private readonly bucketName: string;
  private readonly storageMode: "local" | "s3" | "minio";

  constructor(private readonly configService?: ConfigService) {
    const mode =
      this.configService?.get<string>("STORAGE_MODE") ??
      this.configService?.get<string>("STORAGE_PROVIDER", "local") ??
      "local";
    this.storageMode = this.normalizeMode(mode);
    const envName = this.normalizeEnv(
      this.configService?.get<string>("APP_ENV") ??
        this.configService?.get<string>("NODE_ENV", "dev") ??
        "dev"
    );
    this.bucketName =
      this.configService?.get<string>("STORAGE_BUCKET") ??
      `ai-app-uploads-${envName}`;
  }

  async saveFile(params: {
    ownerUserId: string;
    attachmentId: string;
    buffer: Buffer;
    extension: string;
    storageKey: string;
  }) {
    if (this.storageMode !== "local") {
      throw new Error("S3/MinIO provider not implemented yet");
    }
    const root = path.join(process.cwd(), "uploads", this.bucketName);
    const filePath = path.join(root, params.storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.buffer);
    return {
      storageKey: params.storageKey
    };
  }

  private normalizeMode(
    mode?: string | null
  ): "local" | "s3" | "minio" {
    if (!mode) return "local";
    const normalized = mode.toLowerCase();
    if (normalized === "s3" || normalized === "minio") {
      return normalized;
    }
    return "local";
  }

  private normalizeEnv(env?: string | null) {
    if (!env) return "dev";
    const normalized = env.toLowerCase();
    if (normalized === "production") {
      return "prod";
    }
    if (normalized === "development") {
      return "dev";
    }
    if (normalized === "staging" || normalized === "prod" || normalized === "dev") {
      return normalized;
    }
    return "dev";
  }
}
