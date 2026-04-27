// orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CreatePosOrderDto } from "./dto/create-pos-order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles, CurrentUser } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";
import { OrderStatus, OrderType } from "./order.entity";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // ─── Static GET routes — must come BEFORE @Get(':id') ────────────
  @Get()
  findAll(
    @Query("type") type?: OrderType,
    @Query("status") status?: OrderStatus,
    @Query("search") search?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.ordersService.findAll({
      type,
      status,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get("today-summary")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getTodaySummary() {
    return this.ordersService.getTodaySummary();
  }

  @Get("report/x")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  xReport(@Query("date") date: string, @CurrentUser() user: any) {
    return this.ordersService.getXReport(
      date || new Date().toISOString().slice(0, 10),
      user.id,
    );
  }

  @Get("report/z")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  zReport(@Query("date") date: string, @CurrentUser() user: any) {
    return this.ordersService.getZReport(
      date || new Date().toISOString().slice(0, 10),
      user.id,
    );
  }

  // Lookup by human-readable order number (e.g. POS-20260422-12345)
  @Get("by-no/:orderNo")
  findByOrderNo(@Param("orderNo") orderNo: string) {
    return this.ordersService.findByOrderNo(orderNo);
  }

  // ─── Parameterized GET — must come AFTER all static GETs ─────────
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findById(id);
  }

  // ─── POSTs ────────────────────────────────────────────────────────
  @Post("pos")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  createPos(@Body() dto: CreatePosOrderDto, @CurrentUser() user: any) {
    return this.ordersService.createPosOrder(dto, user.id);
  }

  @Post("online")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.ADMIN)
  createOnline(@Body() dto: any, @CurrentUser() user: any) {
    return this.ordersService.createOnlineOrder(dto, user.id);
  }

  // Return accepts either UUID or order number — service handles both
  @Post("return/:orderIdentifier")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  returnOrder(
    @Param("orderIdentifier") orderIdentifier: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: any,
  ) {
    return this.ordersService.returnOrder(orderIdentifier, dto.reason, user.id);
  }

  // ─── PATCHes ──────────────────────────────────────────────────────
  @Patch(":id/status")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: { status: OrderStatus },
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user.id);
  }

  @Patch(":id/cancel")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  cancel(
    @Param("id") id: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: any,
  ) {
    return this.ordersService.cancelOrder(id, dto.reason, user.id);
  }

  @Patch(":id/items/:itemId/check")
  checkItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.checkItem(id, itemId, user.id);
  }

  @Patch(":id/slip")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  saveSlip(@Param("id") id: string, @Body() dto: { slipUrl: string }) {
    return this.ordersService.saveSlipUrl(id, dto.slipUrl);
  }
}
