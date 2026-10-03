import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CompaniesService } from './companies.service';

test('duplicate company domain is rejected before company creation', async () => {
  const prisma = {
    companyDomain: {
      findUnique: async ({ where }: { where: { domain: string } }) => ({
        id: 'existing-domain',
        companyId: 'other-company-id',
        domain: where.domain,
      }),
    },
    company: {
      create: async () => {
        throw new Error('company should not be created when the domain already exists');
      },
    },
    priceTier: {
      findUnique: async () => null,
    },
    staffUser: {
      findUnique: async () => null,
    },
    employee: {
      findUnique: async () => null,
    },
  };

  const service = new CompaniesService(prisma as any);

  await assert.rejects(
    () => service.create({ name: 'My New Company', domains: ['acme.com', 'acme.com'] }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.match(String(error.message), /Duplicate domain 'acme.com' in the same request\.|already assigned to another company/);
      return true;
    },
  );
});
