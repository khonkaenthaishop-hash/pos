import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ShipmentService, CreateShipmentDto } from "./shipment.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles, CurrentUser } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";

@ApiTags("Shipments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("shipments")
export class ShipmentController {
  constructor(private readonly service: ShipmentService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  findAll(
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.service.findAll(search, Number(page) || 1, Number(limit) || 20);
  }

  @Get("shippable-orders")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  findShippableOrders(@Query("search") search?: string) {
    return this.service.findOrdersToShip(search);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: any) {
    // Accepts orderNumber in the body, enabling non-UUID usage
    return this.service.create(dto, user.id);
  }
}
