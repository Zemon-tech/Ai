import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import createError from 'http-errors';
import { UserModel } from '../models/User';
import { generateTokenId, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../middleware/auth';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name?: string };
    if (!email || !password) throw createError(400, 'Email and password are required');
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) throw createError(409, 'Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ email, passwordHash, name });
    const jti = generateTokenId();
    const access = signAccessToken({ userId: user._id.toString() });
    const refresh = signRefreshToken({ userId: user._id.toString(), jti });
    await UserModel.updateOne(
      { _id: user._id },
      { $push: { refreshTokens: { tokenId: jti, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }
    );
    setAuthCookies(res, access, refresh);
    res.status(201).json({ user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) throw createError(400, 'Email and password are required');
    const user = await UserModel.findOne({ email });
    if (!user) throw createError(401, 'Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createError(401, 'Invalid credentials');
    const jti = generateTokenId();
    const access = signAccessToken({ userId: user._id.toString() });
    const refresh = signRefreshToken({ userId: user._id.toString(), jti });
    user.refreshTokens.push({ tokenId: jti, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    await user.save();
    setAuthCookies(res, access, refresh);
    res.json({ user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw createError(401, 'No refresh token');
    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.userId);
    if (!user) throw createError(401, 'Invalid refresh token');
    const hasToken = user.refreshTokens.some((t) => t.tokenId === payload.jti && t.expiresAt > new Date());
    if (!hasToken) throw createError(401, 'Invalid refresh token');
    const newAccess = signAccessToken({ userId: user._id.toString() });
    res.cookie(ACCESS_COOKIE, newAccess, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await UserModel.updateOne({ _id: payload.userId }, { $pull: { refreshTokens: { tokenId: payload.jti } } });
      } catch {
        // ignore
      }
    }
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const user = await UserModel.findById(userId).lean();
    if (!user) throw createError(404, 'User not found');
    res.json({ user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}


