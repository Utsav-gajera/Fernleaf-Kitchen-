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
import {
  CategoryDishAssignmentBodyDto,
  CreateCategoryDto,
  CreateDishDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  CreateReferenceItemDto,
  DishListQueryDto,
  OptionGroupOptionSyncDto,
  UpdateCategoryDto,
  UpdateDishDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
} from './dto/catalogue.dto';
import { CatalogueService } from './catalogue.service';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('reference-data')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getReferenceData() {
    return this.catalogueService.findReferenceData();
  }

  @Get('dishes')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllDishes(@Query() query: DishListQueryDto) {
    return this.catalogueService.findAllDishes(query.page, query.limit);
  }

  @Get('dishes/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findOneDish(@Param('id') id: string) {
    return this.catalogueService.findOneDish(id);
  }

  @Post('dishes')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createDish(@Body() data: CreateDishDto) {
    return this.catalogueService.createDish(data);
  }

  @Patch('dishes/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateDish(@Param('id') id: string, @Body() data: UpdateDishDto) {
    return this.catalogueService.updateDish(id, data);
  }

  @Patch('dishes/:id/toggle-active')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async toggleDishActive(@Param('id') id: string) {
    return this.catalogueService.toggleDishActive(id);
  }

  @Get('options')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllOptions(@Query() query: DishListQueryDto) {
    return this.catalogueService.findAllOptions(query.page, query.limit);
  }

  @Get('options/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findOneOption(@Param('id') id: string) {
    return this.catalogueService.findOneOption(id);
  }

  @Post('options')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createOption(@Body() data: CreateOptionDto) {
    return this.catalogueService.createOption(data);
  }

  @Patch('options/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateOption(@Param('id') id: string, @Body() data: UpdateOptionDto) {
    return this.catalogueService.updateOption(id, data);
  }

  @Patch('options/:id/toggle-active')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async toggleOptionActive(@Param('id') id: string) {
    return this.catalogueService.toggleOptionActive(id);
  }

  @Get('option-groups')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllOptionGroups(@Query() query: DishListQueryDto) {
    return this.catalogueService.findAllOptionGroups(query.page, query.limit);
  }

  @Get('option-groups/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findOneOptionGroup(@Param('id') id: string) {
    return this.catalogueService.findOneOptionGroup(id);
  }

  @Post('option-groups')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createOptionGroup(@Body() data: CreateOptionGroupDto) {
    return this.catalogueService.createOptionGroup(data);
  }

  @Patch('option-groups/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateOptionGroup(@Param('id') id: string, @Body() data: UpdateOptionGroupDto) {
    return this.catalogueService.updateOptionGroup(id, data);
  }

  @Patch('option-groups/:id/options')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async syncOptionGroupOptions(@Param('id') id: string, @Body() data: OptionGroupOptionSyncDto) {
    return this.catalogueService.syncOptionGroupOptions(id, data.items);
  }

  @Get('allergens')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllAllergens() {
    return this.catalogueService.findAllAllergens();
  }

  @Post('allergens')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createAllergen(@Body() data: CreateReferenceItemDto) {
    return this.catalogueService.createAllergen(data);
  }

  @Patch('allergens/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateAllergen(@Param('id') id: string, @Body() data: CreateReferenceItemDto) {
    return this.catalogueService.updateAllergen(id, data);
  }

  @Get('dietary-tags')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllDietaryTags() {
    return this.catalogueService.findAllDietaryTags();
  }

  @Post('dietary-tags')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createDietaryTag(@Body() data: CreateReferenceItemDto) {
    return this.catalogueService.createDietaryTag(data);
  }

  @Patch('dietary-tags/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateDietaryTag(@Param('id') id: string, @Body() data: CreateReferenceItemDto) {
    return this.catalogueService.updateDietaryTag(id, data);
  }

  @Get('kitchen-stations')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllKitchenStations() {
    return this.catalogueService.findAllKitchenStations();
  }

  @Post('kitchen-stations')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createKitchenStation(@Body() data: CreateReferenceItemDto) {
    return this.catalogueService.createKitchenStation(data);
  }

  @Patch('kitchen-stations/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateKitchenStation(@Param('id') id: string, @Body() data: CreateReferenceItemDto) {
    return this.catalogueService.updateKitchenStation(id, data);
  }

  @Get('categories')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllCategories() {
    return this.catalogueService.findAllCategories();
  }

  @Post('categories')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createCategory(@Body() data: CreateCategoryDto) {
    return this.catalogueService.createCategory(data);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateCategory(@Param('id') id: string, @Body() data: UpdateCategoryDto) {
    return this.catalogueService.updateCategory(id, data);
  }

  @Patch('categories/:id/toggle-active')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async toggleCategoryActive(@Param('id') id: string) {
    return this.catalogueService.toggleCategoryActive(id);
  }

  @Post('categories/:id/dishes')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async assignDishToCategory(@Param('id') categoryId: string, @Body() data: CategoryDishAssignmentBodyDto) {
    return this.catalogueService.upsertCategoryDishAssignment(categoryId, data);
  }

  @Delete('categories/:categoryId/dishes/:dishId')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async removeDishFromCategory(@Param('categoryId') categoryId: string, @Param('dishId') dishId: string) {
    return this.catalogueService.removeCategoryDishAssignment(categoryId, dishId);
  }
}
