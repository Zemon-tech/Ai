import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { AuthenticatedRequest } from '../middleware/auth';

export async function listConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const conversations = await ConversationModel.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

export async function createConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { title } = req.body as { title?: string };
    const conversation = await ConversationModel.create({ userId, title: title || 'New Chat' });
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };
    const conv = await ConversationModel.findOne({ _id: id, userId });
    if (!conv) throw createError(404, 'Conversation not found');
    await MessageModel.deleteMany({ conversationId: conv._id });
    await conv.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function updateConversationTitle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params as { id: string };
    const { title } = req.body as { title: string };
    if (!title) throw createError(400, 'Title required');
    const conv = await ConversationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { title } },
      { new: true }
    );
    if (!conv) throw createError(404, 'Conversation not found');
    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
}


