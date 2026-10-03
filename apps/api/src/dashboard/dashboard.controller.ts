import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Request() req: { user: { role: string; id: string } }) {
    return this.dashboardService.getRoleDashboard(req.user.role, req.user.id);
  }
}
