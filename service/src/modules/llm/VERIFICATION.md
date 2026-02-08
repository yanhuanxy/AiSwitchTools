# LlmService Dual-Client Verification

## 1. Environment Configuration

The service is configured to support both OpenAI and Anthropic clients via `.env`:

```ini
# OpenAI Configuration
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.moonshot.cn/v1"
CHAT_DEFAULT_MODEL="moonshot-v1-8k"

# Anthropic Configuration (Legacy/Specific)
ANTHROPIC_BASE_URL="https://api.moonshot.cn/anthropic"
ANTHROPIC_AUTH_TOKEN="sk-..."
ANTHROPIC_MODEL="kimi-k2-0905-preview"
```

## 2. Client Selection Logic

`LlmService` automatically selects the appropriate client based on the requested model:

- **Anthropic Client** is used if:
    - The model matches `ANTHROPIC_MODEL` (e.g., `kimi-k2-0905-preview`).
    - The model name starts with `claude-` or `kimi-`.
    - Only Anthropic client is initialized (fallback).

- **OpenAI Client** is used if:
    - The model matches `CHAT_DEFAULT_MODEL`.
    - Default behavior for other models.

## 3. Usage

The `ChatService` and `SummariesProvider` automatically use `LlmService`. No code changes are required in consumers. They simply pass the model name (from `Task` or config), and `LlmService` routes the request.

## 4. Verification

- **Initialization**: Both clients are initialized in the constructor if keys are present.
- **Streaming**: Both `chatStreamOpenAI` and `chatStreamAnthropic` return a unified `AsyncIterable<UnifiedChunk>`, ensuring consumers (like `ChatService`) don't need to know which client is used.
- **Completion**: Similarly unified.

This setup ensures backward compatibility with the provided Anthropic configuration while maintaining the modern OpenAI-compatible integration.
