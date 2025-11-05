import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { streamAIResponse } from '../controllers/aiController';

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.post('/stream', streamAIResponse);


