import type { ChatClient } from '../chatClient';
import { OpenAiChatClient } from './OpenAiChatClient';
import { AnthropicChatClient } from './AnthropicChatClient';

export interface ChatClientModelConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
}

export function buildChatClientForModel(config: ChatClientModelConfig): ChatClient {
  if (config.provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required to use OpenAI provider');
    }
    return new OpenAiChatClient({
      apiKey,
      model: config.model,
      baseUrl: process.env.OPENAI_API_BASE,
    });
  }

  if (config.provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required to use Anthropic provider');
    }
    return new AnthropicChatClient({
      apiKey,
      model: config.model,
      baseUrl: process.env.ANTHROPIC_API_BASE,
      version: process.env.ANTHROPIC_API_VERSION,
    });
  }

  throw new Error(`Unsupported chat provider for LLM client: ${config.provider}`);
}

