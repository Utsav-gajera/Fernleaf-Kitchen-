import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

const GLOBAL_RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 };
const LOGIN_RATE_LIMIT = { maxRequests: 10, windowMs: 15 * 60_000 };

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();

function requireProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!databaseUrl) throw new Error('DATABASE_URL is required in production.');
  if (!frontendUrl) throw new Error('FRONTEND_URL is required in production.');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  let parsedFrontendUrl: URL;
  try {
    parsedFrontendUrl = new URL(frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be an absolute URL in production.');
  }

  if (parsedFrontendUrl.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must use HTTPS in production.');
  }
}

function securityAndRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.path === '/health' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const limit = req.path === '/auth/login' ? LOGIN_RATE_LIMIT : GLOBAL_RATE_LIMIT;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `${req.path === '/auth/login' ? 'login' : 'global'}:${clientIp}`;
  const now = Date.now();
  const existing = rateLimitEntries.get(key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + limit.windowMs }
    : existing;

  entry.count += 1;
  rateLimitEntries.set(key, entry);
  if (entry.count > limit.maxRequests) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({ statusCode: 429, message: 'Too many requests. Please try again later.' });
    return;
  }

  next();
}

async function bootstrap() {
  requireProductionEnvironment();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(securityAndRateLimitMiddleware);
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Enable CORS so the Next.js frontend can communicate smoothly
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global request validation using class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 NestJS Backend running at http://localhost:${port}`);
}

bootstrap();
