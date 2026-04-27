import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * GET /api/v1/stock
   * Returns all active products with their current stock levels.
   * Supports ?search, ?categoryId, ?lowStock=true filters.
   */
  @Get()
  getStock(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.productsService.findAll({
      search,
      categoryId,
      lowStock: lowStock === 'true',
    });
  }
}
