import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Roles(Role.ADMIN)
  async updateSettings(@Body() data: Record<string, unknown>) {
    return this.settingsService.updateSettings(data);
  }
}
