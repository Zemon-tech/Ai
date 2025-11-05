import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createConversation, deleteConversation, listConversations, updateConversationTitle } from '../controllers/conversationController';
import { getConversationMessages } from '../controllers/messageController';

export const conversationRouter = Router();

conversationRouter.use(requireAuth);
conversationRouter.get('/', listConversations);
conversationRouter.post('/', createConversation);
conversationRouter.get('/:id/messages', getConversationMessages);
conversationRouter.delete('/:id', deleteConversation);
conversationRouter.patch('/:id/title', updateConversationTitle);


