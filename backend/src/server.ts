import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import createError from 'http-errors';
import { connectToDatabase } from './config/db';
import { env } from './config/env';

// Routes
import { router as apiRouter } from './routes';

const app = express();

// Security & common middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    legacyHeaders: false,
    standardHeaders: true,
  })
);

// Healthcheck
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// API routes
app.use('/api', apiRouter);

// 404 handler
app.use((_req, _res, next) => {
  next(createError(404, 'Not Found'));
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  if (env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ error: message });
});

async function bootstrap() {
  await connectToDatabase();
  const port = env.PORT;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});


