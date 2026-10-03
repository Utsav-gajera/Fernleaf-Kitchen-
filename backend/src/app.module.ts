import { Module, Get, Controller } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';

@Controller()
class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getRoot() {
    return {
      name: 'Starter Boilerplate Backend API',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected (Cloud PostgreSQL)',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
