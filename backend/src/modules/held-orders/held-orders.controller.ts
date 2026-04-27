import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { HeldOrdersService } from './held-orders.service';
import { HoldDto } from './dto/hold.dto';

@ApiTags('Held Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('held-orders')
export class HeldOrdersController {
  constructor(private readonly svc: HeldOrdersService) {}

  /**
   * GET /api/v1/held-orders
   * List held order summaries (no cart JSON).
   * Cashiers only see their own; managers/owners see all.
   */
  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  list(@CurrentUser() user: any, @Query('all') all?: string) {
    const isManager = [UserRole.OWNER, UserRole.MANAGER].includes(user.role);
    const cashierId = (isManager && all === 'true') ? undefined : user.id;
    return this.svc.list(cashierId);
  }

  /**
   * GET /api/v1/held-orders/:id
   * Full held order including cart JSON.
   */
  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  getOne(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  /**
   * POST /api/v1/held-orders
   * Save current cart as a held order.
   */
  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  hold(@Body() dto: HoldDto, @CurrentUser() user: any) {
    return this.svc.hold(dto, user.id);
  }

  /**
   * POST /api/v1/held-orders/:id/resume
   * Return the full cart and delete the held record atomically.
   */
  @Post(':id/resume')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  resume(@Param('id') id: string) {
    return this.svc.resume(id);
  }

  /**
   * DELETE /api/v1/held-orders/:id
   * Permanently discard a held order.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  discard(@Param('id') id: string) {
    return this.svc.discard(id);
  }
}
