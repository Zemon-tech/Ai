import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthenticatedRequest } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { env } from '../config/env';
import { uploadImageFromBuffer } from '../services/supabase';

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1];
  const base64 = m[2];
  const buffer = Buffer.from(base64, 'base64');
  return { mime, buffer };
}

// POST /api/ai/image/analyze
// body: { prompt: string; images: { url: string; mediaType?: string; filename?: string }[] }
export async function analyzeImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!env.GEMINI_API_KEY) throw createError(500, 'GEMINI_API_KEY not configured');
    const userId = req.user!.userId;
    const { prompt, images, conversationId } = req.body as { prompt?: string; images?: { url: string; mediaType?: string; filename?: string }[]; conversationId?: string };
    if (!prompt || !Array.isArray(images) || images.length === 0) {
      throw createError(400, 'prompt and images[] are required');
    }

    // Ensure Supabase config present
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_BUCKET) {
      throw createError(500, 'Supabase configuration missing');
    }

    // Upload any data URLs to Supabase (for persistence) and collect public URLs
    const now = Date.now();
    const publicUrls: string[] = [];
    const originalUrls: string[] = images.map((img) => img.url).filter(Boolean) as string[];
    for (let i = 0; i < images.length; i++) {
      const { url, mediaType, filename } = images[i];
      if (!url) continue;
      if (url.startsWith('data:')) {
        const { mime, buffer } = parseDataUrl(url);
        const ext = (mime.split('/')[1] || 'bin').split('+')[0];
        const safeName = (filename && filename.replace(/[^a-zA-Z0-9._-]/g, '_')) || `image_${i}.${ext}`;
        const path = `users/${userId}/${now}_${i}_${safeName}`;
        const { publicUrl } = await uploadImageFromBuffer(path, buffer, mediaType || mime);
        publicUrls.push(publicUrl);
      } else {
        // Assume it is already a reachable URL
        publicUrls.push(url);
      }
    }

    if (publicUrls.length === 0) throw createError(400, 'No valid images to analyze');

    // Prefer data URLs for Gemini OpenAI-compatible image input; fallback to public URLs
    const urlsForGemini = originalUrls.map((u, idx) => (u.startsWith('data:') ? u : (publicUrls[idx] || u)));
    const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    const body = {
      model: (env as any).GEMINI_MODEL || 'gemini-2.0-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...urlsForGemini.map((u) => ({ type: 'image_url', image_url: { url: u } })),
          ],
        },
      ],
    };

    const r = await fetch(baseURL + 'chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw createError(502, `Gemini request failed: ${r.status} ${t}`);
    }
    const data = await r.json();
    // Try to extract text from choices
    let text = '';
    try {
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      if (typeof msg?.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg?.content)) {
        const part = msg.content.find((p: any) => p?.type === 'text');
        text = part?.text || '';
      } else if (choice?.text) {
        text = String(choice.text);
      }
    } catch {}

    // Persist conversation and messages
    let convId = conversationId;
    if (convId) {
      const conv = await ConversationModel.findOne({ _id: convId, userId }).lean();
      if (!conv) throw createError(404, 'Conversation not found');
    } else {
      const title = prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt;
      const conv = await ConversationModel.create({ userId, title: title || 'New Chat' });
      convId = conv._id.toString();
    }

    const attachments = images.map((img, i) => ({ url: publicUrls[i] || img.url, mediaType: img.mediaType, filename: img.filename }));
    await MessageModel.create({ conversationId: convId, userId, role: 'user', content: prompt, attachments });
    await MessageModel.create({ conversationId: convId, userId, role: 'assistant', content: text || '' });

    res.json({ text, images: publicUrls, conversationId: convId });
  } catch (err) {
    next(err);
  }
}
