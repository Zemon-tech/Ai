import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getConversationMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };
    const { page = '1', pageSize = '50' } = req.query as { page?: string; pageSize?: string };
    const conv = await ConversationModel.findOne({ _id: id, userId }).lean();
    if (!conv) throw createError(404, 'Conversation not found');
    const p = Math.max(parseInt(page), 1);
    const ps = Math.min(Math.max(parseInt(pageSize), 1), 200);
    const messages = await MessageModel.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .skip((p - 1) * ps)
      .limit(ps)
      .lean();
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}


