import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { env } from '../config/env';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

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

    // Prepare streaming
    const provider = google({ apiKey: env.GEMINI_API_KEY });
    const response = await streamText({
      model: provider('gemini-1.5-flash'),
      messages: [
        { role: 'user', content: message },
      ],
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let assistantText = '';
    for await (const delta of response.textStream) {
      assistantText += delta;
      res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`);
    }

    // Persist assistant message
    await MessageModel.create({ conversationId: convId, userId, role: 'assistant', content: assistantText });

    // Notify completion and conversationId for newly created chats
    res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
}


