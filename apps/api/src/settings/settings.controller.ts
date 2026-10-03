import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';
import { UpdateSettingsDto } from './dto/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  async updateSettings(@Body() data: UpdateSettingsDto) {
    return this.settingsService.updateSettings(data);
  }
}
