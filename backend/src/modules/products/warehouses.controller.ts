import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { LocationsService } from './locations.service';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * GET /api/v1/warehouses
   * List all active warehouse / shelf locations.
   */
  @Get()
  findAll() {
    return this.locationsService.listLocations();
  }

  /**
   * POST /api/v1/warehouses
   * Create a new location.
   */
  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(@Body() dto: { fullCode: string; zone?: string; aisle?: string; shelf?: string; bin?: string }) {
    return this.locationsService.createLocation(dto.fullCode, dto);
  }
}
