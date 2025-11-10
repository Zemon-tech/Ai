import { Response, NextFunction } from 'express';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { env } from '../config/env';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouterClient, getOpenRouterModelId } from '../ai/openrouterProvider';
import { streamText, generateText } from 'ai';

// Load system prompt from file with fallback
const SYSTEM_PROMPT: string = (() => {
  const candidates = [
    // Build output relative to compiled file
    path.resolve(__dirname, '../prompts/system.md'),
    // Monorepo/workspace execution from project root (ts-node/dev)
    path.resolve(process.cwd(), 'backend/src/prompts/system.md'),
    // Possible dist prompt alongside compiled output
    path.resolve(process.cwd(), 'backend/dist/prompts/system.md'),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8');
      }
    } catch {}
  }
  return 'You are a helpful assistant.';
})();

// POST /api/ai/title
// body: { conversationId: string }
export async function generateConversationTitle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { conversationId } = req.body as { conversationId?: string };
    if (!conversationId) {
      throw createError(400, 'conversationId is required');
    }

    const conv = await ConversationModel.findOne({ _id: conversationId, userId });
    if (!conv) throw createError(404, 'Conversation not found');

    // If the title already looks custom (not default), we can still allow regeneration but it's fine.
    const msgs = await MessageModel.find({ conversationId, userId })
      .sort({ createdAt: 1 })
      .lean();

    const combined = msgs
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .slice(0, 8000); // keep prompt bounded

    const provider = (req.body?.provider as 'gemini' | 'openrouter' | undefined) || env.AI_PROVIDER;
    let modelId: string;
    let openAIProvider: ReturnType<typeof createOpenAI>;

    if (provider === 'openrouter') {
      openAIProvider = createOpenRouterClient();
      modelId = getOpenRouterModelId();
    } else {
      const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      modelId = (env as any).GEMINI_MODEL || 'gemini-2.0-flash';
      openAIProvider = createOpenAI({ apiKey: env.GEMINI_API_KEY, baseURL });
    }

    const system = `You generate ultra-concise chat titles.
Rules:
- 2 or 3 words maximum.
- Title case.
- No punctuation, no quotes, no emojis.
- Capture the main topic of the conversation.
Return only the title.`;

    const { text } = await generateText({
      model: openAIProvider.chat(modelId),
      system: system,
      messages: [
        { role: 'user', content: `Conversation transcript (truncated):\n\n${combined}` },
      ],
    });

    let title = (text || '').trim();
    // Post-process: strip quotes/punctuation and enforce shortness
    title = title
      .replace(/^"|"$/g, '')
      .replace(/[.,;:!?\-_/\\()[\]{}"'`~*@#%^&+=|<>]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Fallbacks
    if (!title) {
      const firstUser = msgs.find((m) => m.role === 'user')?.content || 'New Chat';
      title = (firstUser.length > 30 ? firstUser.slice(0, 30) + '…' : firstUser).trim();
    }

    // Ensure max 3 words
    const words = title.split(' ').filter(Boolean).slice(0, 3);
    title = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    conv.title = title || conv.title;
    await conv.save();

    res.json({ title: conv.title });
  } catch (err) {
    next(err);
  }
}

// POST /api/ai/stream
// body: { conversationId?: string, message: string }
export async function streamAIResponse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { conversationId, message } = req.body as { conversationId?: string; message: string };
    if (!message) throw createError(400, 'Message is required');

    let convId = conversationId;
    if (convId) {
      const conv = await ConversationModel.findOne({ _id: convId, userId }).lean();
      if (!conv) throw createError(404, 'Conversation not found');
    } else {
      const title = message.length > 60 ? message.slice(0, 60) + '…' : message;
      const conv = await ConversationModel.create({ userId, title: title || 'New Chat' });
      convId = conv._id.toString();
    }

    // Save user message
    await MessageModel.create({ conversationId: convId, userId, role: 'user', content: message });

    // Select provider (Gemini default) or OpenRouter via OpenAI-compatible SDK
    const provider = (req.body as any)?.provider as 'gemini' | 'openrouter' | undefined || env.AI_PROVIDER;
    let modelId: string;
    let openAIProvider: ReturnType<typeof createOpenAI>;
    if (provider === 'openrouter') {
      openAIProvider = createOpenRouterClient();
      modelId = getOpenRouterModelId();
    } else {
      const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      modelId = (env as any).GEMINI_MODEL || 'gemini-2.0-flash';
      openAIProvider = createOpenAI({ apiKey: env.GEMINI_API_KEY, baseURL });
    }

    let response;
    try {
      // Fetch full conversation history and include it for context (limited to recent turns for safety)
      const history = await MessageModel.find({ conversationId: convId, userId })
        .sort({ createdAt: 1 })
        .lean();

      // Keep only the most recent 30 turns (messages) to stay well within context limits
      const MAX_TURNS = 30;
      const recent = history.slice(Math.max(0, history.length - MAX_TURNS));

      const chatMessages = recent.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      response = await streamText({
        model: openAIProvider.chat(modelId),
        system: SYSTEM_PROMPT,
        messages: chatMessages,
      });
    } catch (err) {
      // If model call fails before streaming starts, propagate a 502 without sending SSE headers
      return next(createError(502, (err as Error).message));
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let assistantText = '';
    try {
      for await (const delta of response.textStream) {
        assistantText += delta;
        res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
      }
    } catch (err) {
      // End SSE stream gracefully on error to avoid double-send
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
      res.end();
      return;
    }

    // Persist assistant message
    if (assistantText.trim()) {
      await MessageModel.create({ conversationId: convId, userId, role: 'assistant', content: assistantText });
    }

    // Notify completion and conversationId for newly created chats
    res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
}


