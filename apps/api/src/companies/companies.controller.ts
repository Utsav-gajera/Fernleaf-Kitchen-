import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@project/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { CompaniesService } from './companies.service';
import {
  CompanyAddressDto,
  CompanyDomainDto,
  CompanyHolidayDto,
  CompanyListQueryDto,
  CreateCompanyDto,
  UpdateCompanyDefaultsDto,
  UpdateCompanyDto,
  UpdateCompanyWorkingDaysDto,
} from './dto/company.dto';
import { UpdateCompanyMenuVisibilityDto } from './dto/company-menu-visibility.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async findAll(@Query() query: CompanyListQueryDto) {
    return this.companiesService.findAll(query.page, query.limit);
  }

  @Get(':id')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async create(@Body() data: CreateCompanyDto) {
    return this.companiesService.create(data);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async update(@Param('id') id: string, @Body() data: UpdateCompanyDto) {
    return this.companiesService.update(id, data);
  }

  @Post(':id/domains')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async addDomain(@Param('id') id: string, @Body() data: CompanyDomainDto) {
    return this.companiesService.addDomain(id, data.domain);
  }

  @Delete(':id/domains/:domain')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async removeDomain(@Param('id') id: string, @Param('domain') domain: string) {
    return this.companiesService.removeDomain(id, domain);
  }

  @Post(':id/addresses')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async addAddress(@Param('id') id: string, @Body() data: CompanyAddressDto) {
    return this.companiesService.addAddress(id, data);
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() data: Partial<CompanyAddressDto>,
  ) {
    return this.companiesService.updateAddress(id, addressId, data);
  }

  @Delete(':id/addresses/:addressId')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async deleteAddress(@Param('id') id: string, @Param('addressId') addressId: string) {
    return this.companiesService.deleteAddress(id, addressId);
  }

  @Patch(':id/working-days')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updateWorkingDays(@Param('id') id: string, @Body() data: UpdateCompanyWorkingDaysDto) {
    return this.companiesService.updateWorkingDays(id, data);
  }

  @Post(':id/holidays')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async addHoliday(@Param('id') id: string, @Body() data: CompanyHolidayDto) {
    return this.companiesService.addHoliday(id, data);
  }

  @Delete(':id/holidays/:date')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async removeHoliday(@Param('id') id: string, @Param('date') date: string) {
    return this.companiesService.removeHoliday(id, date);
  }

  @Patch(':id/defaults')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updateDefaults(@Param('id') id: string, @Body() data: UpdateCompanyDefaultsDto) {
    return this.companiesService.updateDefaults(id, data);
  }

  @Patch(':id/price-tier')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updatePriceTier(@Param('id') id: string, @Body('priceTierId') priceTierId: string) {
    return this.companiesService.updatePriceTier(id, priceTierId);
  }

  @Patch(':id/default-driver')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updateDefaultDriver(@Param('id') id: string, @Body('defaultDriverId') defaultDriverId?: string) {
    return this.companiesService.updateDefaultDriver(id, defaultDriverId);
  }

  @Get(':id/menu-visibility')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async getMenuVisibility(@Param('id') id: string) {
    return this.companiesService.getMenuVisibility(id);
  }

  @Patch(':id/menu-visibility')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async updateMenuVisibility(
    @Param('id') id: string,
    @Body() data: UpdateCompanyMenuVisibilityDto,
  ) {
    return this.companiesService.updateMenuVisibility(id, data);
  }
}
