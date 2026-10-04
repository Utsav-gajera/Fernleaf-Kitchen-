import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

for (const [code, expectedStatus] of [
  ['P2002', 409],
  ['P2003', 400],
  ['P2025', 404],
  ['P9999', 500],
] as const) {
  test(`maps Prisma ${code} to HTTP ${expectedStatus}`, () => {
    let status = 0;
    let body: { statusCode: number; message: string } | undefined;
    const response = {
      status(value: number) {
        status = value;
        return this;
      },
      json(value: { statusCode: number; message: string }) {
        body = value;
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    const error = new Prisma.PrismaClientKnownRequestError('database details', {
      code,
      clientVersion: '5.22.0',
    });

    new PrismaExceptionFilter().catch(error, host);

    assert.equal(status, expectedStatus);
    assert.equal(body?.statusCode, expectedStatus);
    assert.ok(body?.message);
    assert.equal(body?.message.includes('database details'), false);
  });
}
