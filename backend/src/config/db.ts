import mongoose from 'mongoose';
import { env } from './env';

export async function connectToDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB');
}


