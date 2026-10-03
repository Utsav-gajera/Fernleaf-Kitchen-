import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTiers() {
    const tiers = await this.prisma.priceTier.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        multiplier: true,
      },
    });

    return {
      message: 'Price tiers retrieved successfully.',
      data: tiers,
    };
  }

  async calculateDishPrice(dishId: string, companyTierId?: string) {
    return {
      message: `Price calculated for dish ${dishId} on tier ${companyTierId} (placeholder)`,
      price: 0,
    };
  }
}
