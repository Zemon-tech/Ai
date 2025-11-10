import dotenv from 'dotenv';

dotenv.config();

function required(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
  PORT: Number(process.env.PORT || 4000),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  CLIENT_ORIGIN: required('CLIENT_ORIGIN', 'http://localhost:5173'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  // Optional provider selection (defaults to gemini to preserve current behavior)
  AI_PROVIDER: (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'openrouter',
  // OpenRouter configuration (optional; only required if using OpenRouter)
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  OPENROUTER_REFERER: process.env.OPENROUTER_REFERER || '',
  OPENROUTER_TITLE: process.env.OPENROUTER_TITLE || 'Quild AI',
};


