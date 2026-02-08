import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { ulid } from "ulid";

@Injectable()
export class ChatProvider {
  generateMessageId() {
    return `msg_${ulid()}`;
  }

  generateTaskId() {
    return `task_${ulid()}`;
  }

  getDefaultModel() {
    return process.env.CHAT_DEFAULT_MODEL ?? "default";
  }

  getSystemPrompt() {
    return process.env.CHAT_SYSTEM_PROMPT ?? "You are a helpful assistant.";
  }

  getReplyTokenLimit(replyLength?: string) {
    switch (replyLength) {
      case "short":
        return 128;
      case "medium":
        return 512;
      case "long":
        return 1024;
      case "auto":
        return 2048;
      default:
        return 512;
    }
  }

  buildIdempotencyKey(params: {
    ownerUserId: string;
    conversationId: string;
    clientMessageId: string;
  }) {
    return `chat:${params.ownerUserId}:${params.conversationId}:${params.clientMessageId}`;
  }

  hashPayload(payload: Record<string, unknown>) {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  getIdempotencyTtlMs() {
    return 24 * 60 * 60 * 1000;
  }
}
