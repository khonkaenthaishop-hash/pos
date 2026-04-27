import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles, CurrentUser } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";
import { ReceiveDto } from "./dto/receive.dto";
import { AdjustDto } from "./dto/adjust.dto";

@ApiTags("Inventory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inventory")
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);
  constructor(private svc: InventoryService) {}

  // ── Reason codes ────────────────────────────────────────────────
  @Get("reason-codes")
  getReasonCodes(@Query("type") type?: string) {
    return this.svc.getReasonCodes(type);
  }

  // ── Transactions ────────────────────────────────────────────────
  @Get("transactions")
  async listTransactions(
    @Query("productId") productId?: string,
    @Query("type") type?: string,
    @Query("reasonCode") reasonCode?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    try {
      return await this.svc.listTransactions({
        productId,
        type,
        reasonCode,
        from,
        to,
        page: Number(page) || 1,
        limit: Number(limit) || 50,
      });
    } catch (err) {
      this.logger.error('listTransactions failed', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  // ── Goods Receipt ───────────────────────────────────────────────
  @Post("receive")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  receive(@Body() dto: ReceiveDto, @CurrentUser() user: any) {
    return this.svc.receive(dto, user.id);
  }

  // ── Stock Adjustment ────────────────────────────────────────────
  @Post("adjust")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  adjust(@Body() dto: AdjustDto, @CurrentUser() user: any) {
    return this.svc.adjust(dto, user.id);
  }

  // ── Discard / Write-off ─────────────────────────────────────────
  @Post("discard")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  discard(@Body() dto: any, @CurrentUser() user: any) {
    return this.svc.discard(dto, user.id);
  }

  // ── Discard summary report ──────────────────────────────────────
  @Get("discard-summary")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  discardSummary(@Query("year") year: string, @Query("month") month: string) {
    const now = new Date();
    return this.svc.discardSummary(
      Number(year) || now.getFullYear(),
      Number(month) || now.getMonth() + 1,
    );
  }

  // ── Suppliers ───────────────────────────────────────────────────
  @Get("suppliers")
  listSuppliers() {
    return this.svc.listSuppliers();
  }

  @Get("suppliers/:id")
  getSupplier(@Param("id") id: string) {
    return this.svc.getSupplier(id);
  }

  @Post("suppliers")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  createSupplier(@Body() dto: any) {
    return this.svc.createSupplier(dto);
  }

  @Patch("suppliers/:id")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateSupplier(@Param("id") id: string, @Body() dto: any) {
    return this.svc.updateSupplier(id, dto);
  }
}
