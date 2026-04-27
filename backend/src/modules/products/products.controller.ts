import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('locationCode') locationCode?: string,
    @Query('lowStock') lowStock?: string,
    @Query('pending') pending?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findAll({
      search,
      categoryId,
      locationCode,
      lowStock: lowStock === 'true',
      pendingApproval: pending === 'true',
      includeInactive: includeInactive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('low-stock')
  getLowStock() {
    return this.productsService.getLowStockProducts();
  }

  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string, @Query('mode') mode?: string) {
    const m = (mode || '').toLowerCase();
    const normalizedMode = (m === 'inventory' || m === 'any') ? (m as any) : 'unit';
    return this.productsService.findByBarcode(barcode, { mode: normalizedMode });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.productsService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.productsService.update(id, dto, user.id);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.OWNER)
  toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.toggleActive(id, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.approve(id, user.id);
  }

  @Patch(':id/price')
  @Roles(UserRole.OWNER)
  updatePrice(
    @Param('id') id: string,
    @Body() dto: { retailPrice?: number; wholesalePrice?: number; costPrice?: number },
    @CurrentUser() user: any,
  ) {
    return this.productsService.updatePrice(id, dto, user.id, user.role);
  }

  @Patch(':id/stock')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  adjustStock(
    @Param('id') id: string,
    @Body() dto: { adjustment: number; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.productsService.adjustStock(id, dto.adjustment, dto.reason, user.id);
  }
}
