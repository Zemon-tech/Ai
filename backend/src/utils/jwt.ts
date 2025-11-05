import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export type JwtUserPayload = { userId: string };

export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: JwtUserPayload & { jti: string; }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
}

export function verifyRefreshToken(token: string): JwtUserPayload & { jti: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtUserPayload & { jti: string };
}

export function generateTokenId(): string {
  return crypto.randomUUID();
}


