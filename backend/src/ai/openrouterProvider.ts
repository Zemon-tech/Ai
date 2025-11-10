import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../config/env';

// Factory to create an OpenAI-compatible client configured for OpenRouter
export function createOpenRouterClient() {
  const baseURL = 'https://openrouter.ai/api/v1';
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required when using OpenRouter provider');
  }
  const headers: Record<string, string> = {};
  if (env.OPENROUTER_REFERER) headers['HTTP-Referer'] = env.OPENROUTER_REFERER;
  if (env.OPENROUTER_TITLE) headers['X-Title'] = env.OPENROUTER_TITLE;

  return createOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL,
    headers,
  });
}

export function getOpenRouterModelId(): string {
  return env.OPENROUTER_MODEL || 'openrouter/auto';
}
