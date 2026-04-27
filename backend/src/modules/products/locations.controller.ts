import {
  Controller, Get, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocationsService, UpdateLocationItem } from './locations.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** GET /locations — list all active locations */
  @Get('locations')
  listLocations() {
    return this.locationsService.listLocations();
  }

  /** GET /products/:id/locations — stock per location for a product */
  @Get('products/:id/locations')
  getProductLocations(@Param('id') id: string) {
    return this.locationsService.getProductLocations(id);
  }

  /** PATCH /products/:id/locations — replace all product locations */
  @Patch('products/:id/locations')
  updateProductLocations(
    @Param('id') id: string,
    @Body() items: UpdateLocationItem[],
  ) {
    return this.locationsService.updateProductLocations(id, items);
  }
}
