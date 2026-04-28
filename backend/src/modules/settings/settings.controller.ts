import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import {
  IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsArray,
  ValidateNested, MaxLength, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class UpdateGeneralDto {
  @IsOptional() @IsString() @MaxLength(100) storeName?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() currency?: string;
}

class UpdateReceiptDto {
  @IsOptional() @IsString() headerText?: string;
  @IsOptional() @IsArray() footerLines?: string[];
  // Backward-compatible fields (UI sends 3 separate footer lines)
  @IsOptional() @IsString() footerLine1?: string;
  @IsOptional() @IsString() footerLine2?: string;
  @IsOptional() @IsString() footerLine3?: string;
  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsBoolean() showQrCode?: boolean;
  @IsOptional() @IsBoolean() showPhone?: boolean;
  @IsOptional() @IsBoolean() showAddress?: boolean;
  @IsOptional() @IsString() @IsIn(['sm', 'md', 'lg']) fontSize?: string;
  @IsOptional() @IsNumber() @IsIn([55, 58, 72, 80]) receiptWidth?: number;
}

class UpdatePrinterDto {
  @IsOptional() @IsString() printerIp?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(65535) printerPort?: number;
  @IsOptional() @IsNumber() @IsIn([55, 58, 72, 80]) paperWidth?: number;
  @IsOptional() @IsString() encoding?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(255) codePage?: number;
  @IsOptional() @IsString() printMode?: string;
  @IsOptional() @IsBoolean() autoPrint?: boolean;
  @IsOptional() @IsNumber() @Min(1) @Max(5) printCopies?: number;
}

class WholesaleTierDto {
  @IsNumber() @Min(1) minQty: number;
  @IsNumber() @Min(0) @Max(100) discountPct: number;
}

class UpdatePricingDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultMarginPct?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(30) taxRate?: number;
  @IsOptional() @IsBoolean() taxIncluded?: boolean;
  @IsOptional() @IsString() roundingPolicy?: string;
  @IsOptional() @IsBoolean() enableWholesale?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WholesaleTierDto)
  wholesaleTiers?: WholesaleTierDto[];
}

class UpdateInventoryDto {
  @IsOptional() @IsNumber() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsBoolean() enableAutoReorder?: boolean;
  @IsOptional() @IsBoolean() expiryTracking?: boolean;
  @IsOptional() @IsNumber() @Min(1) expiryWarningDays?: number;
  @IsOptional() @IsString() defaultSupplierId?: string;
  @IsOptional() @IsBoolean() requireBatchNumber?: boolean;
}

class UpdateShippingDto {
  @IsOptional() @IsString() defaultCarrierId?: string;
  @IsOptional() @IsString() cutoffTime?: string;
  @IsOptional() @IsNumber() @Min(0) packagingFee?: number;
  @IsOptional() @IsNumber() @Min(0) freeShippingThreshold?: number;
  @IsOptional() @IsString() defaultWeightUnit?: string;
}

class UpdateNotificationsDto {
  @IsOptional() @IsBoolean() enableLineNotify?: boolean;
  @IsOptional() @IsString() lineNotifyToken?: string;
  @IsOptional() @IsBoolean() enableEmail?: boolean;
  @IsOptional() @IsString() smtpHost?: string;
  @IsOptional() @IsNumber() smtpPort?: number;
  @IsOptional() @IsString() smtpUser?: string;
  @IsOptional() @IsString() smtpPass?: string;
  @IsOptional() @IsString() fromEmail?: string;
  @IsOptional() @IsBoolean() notifyLowStock?: boolean;
  @IsOptional() @IsBoolean() notifyNewOrder?: boolean;
  @IsOptional() @IsBoolean() notifyDailyReport?: boolean;
  @IsOptional() @IsBoolean() notifyShipmentUpdate?: boolean;
  @IsOptional() @IsString() dailyReportTime?: string;
}

class UpdateAiDto {
  @IsOptional() @IsBoolean() enableAi?: boolean;
  @IsOptional() @IsString() aiProvider?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() apiBaseUrl?: string;
  @IsOptional() @IsString() modelName?: string;
  @IsOptional() @IsBoolean() enableProductDescriptionGen?: boolean;
  @IsOptional() @IsBoolean() enableSalesInsights?: boolean;
  @IsOptional() @IsBoolean() enableDemandForecast?: boolean;
}

class UpdateSecurityDto {
  @IsOptional() @IsNumber() @Min(4) @Max(72) passwordMinLength?: number;
  @IsOptional() @IsBoolean() requireUppercase?: boolean;
  @IsOptional() @IsBoolean() requireNumbers?: boolean;
  @IsOptional() @IsBoolean() requireSpecialChar?: boolean;
  @IsOptional() @IsNumber() @Min(0) passwordExpiryDays?: number;
  @IsOptional() @IsNumber() @Min(0) sessionTimeoutMinutes?: number;
  @IsOptional() @IsNumber() @Min(1) maxConcurrentSessions?: number;
  @IsOptional() @IsBoolean() enable2fa?: boolean;
  @IsOptional() @IsString() twoFaMethod?: string;
  @IsOptional() @IsBoolean() enableIpWhitelist?: boolean;
  @IsOptional() @IsArray() allowedIps?: string[];
}

class UpdateAnalyticsDto {
  @IsOptional() @IsString() defaultDateRange?: string;
  @IsOptional() @IsArray() defaultMetrics?: string[];
  @IsOptional() @IsString() reportTimezone?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(12) fiscalYearStart?: number;
  @IsOptional() @IsBoolean() enableExportButton?: boolean;
}

class UpdateSystemDto {
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
}

class CreateWarehouseDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateWarehouseDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() zone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Controller ────────────────────────────────────────────────────────────────

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // ── General ──────────────────────────────────────────────────────────────
  @Get('general')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getGeneral() { return this.service.getGroup('general'); }

  @Patch('general')
  @Roles(UserRole.OWNER)
  updateGeneral(@Body() dto: UpdateGeneralDto) {
    return this.service.updateGroup('general', dto as any);
  }

  // ── Receipt ───────────────────────────────────────────────────────────────
  @Get('receipt')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.STAFF, UserRole.ADMIN)
  getReceipt() { return this.service.getGroup('receipt'); }

  @Patch('receipt')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateReceipt(@Body() dto: UpdateReceiptDto) {
    return this.service.updateGroup('receipt', dto as any);
  }

  // ── Printer ───────────────────────────────────────────────────────────────
  @Get('printer')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.STAFF, UserRole.ADMIN)
  getPrinter() { return this.service.getGroup('printer'); }

  @Patch('printer')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updatePrinter(@Body() dto: UpdatePrinterDto) {
    return this.service.updateGroup('printer', dto as any);
  }

  // ── Roles & Permissions ───────────────────────────────────────────────────
  @Get('roles-perms')
  @Roles(UserRole.OWNER)
  getRolesPerms() { return this.service.getGroup('roles-perms'); }

  @Patch('roles-perms')
  @Roles(UserRole.OWNER)
  updateRolesPerms(@Body() dto: Record<string, unknown>) {
    return this.service.updateGroup('roles-perms', dto as any);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  @Get('inventory')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getInventory() { return this.service.getGroup('inventory'); }

  @Patch('inventory')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateInventory(@Body() dto: UpdateInventoryDto) {
    return this.service.updateGroup('inventory', dto as any);
  }

  // ── Pricing ───────────────────────────────────────────────────────────────
  @Get('pricing')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getPricing() { return this.service.getGroup('pricing'); }

  @Patch('pricing')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updatePricing(@Body() dto: UpdatePricingDto) {
    return this.service.updateGroup('pricing', dto as any);
  }

  // ── Shipping ──────────────────────────────────────────────────────────────
  @Get('shipping')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getShipping() { return this.service.getGroup('shipping'); }

  @Patch('shipping')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateShipping(@Body() dto: UpdateShippingDto) {
    return this.service.updateGroup('shipping', dto as any);
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  @Get('notifications')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getNotifications() { return this.service.getGroup('notifications'); }

  @Patch('notifications')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateNotifications(@Body() dto: UpdateNotificationsDto) {
    return this.service.updateGroup('notifications', dto as any);
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  @Get('ai')
  @Roles(UserRole.OWNER)
  getAi() { return this.service.getGroup('ai'); }

  @Patch('ai')
  @Roles(UserRole.OWNER)
  updateAi(@Body() dto: UpdateAiDto) {
    return this.service.updateGroup('ai', dto as any);
  }

  // ── Security ──────────────────────────────────────────────────────────────
  @Get('security')
  @Roles(UserRole.OWNER)
  getSecurity() { return this.service.getGroup('security'); }

  @Patch('security')
  @Roles(UserRole.OWNER)
  updateSecurity(@Body() dto: UpdateSecurityDto) {
    return this.service.updateGroup('security', dto as any);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  @Get('analytics')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getAnalytics() { return this.service.getGroup('analytics'); }

  @Patch('analytics')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateAnalytics(@Body() dto: UpdateAnalyticsDto) {
    return this.service.updateGroup('analytics', dto as any);
  }

  // ── System ────────────────────────────────────────────────────────────────
  @Get('system')
  @Roles(UserRole.OWNER)
  getSystem() { return this.service.getSystemInfo(); }

  @Patch('system')
  @Roles(UserRole.OWNER)
  updateSystem(@Body() dto: UpdateSystemDto) {
    return this.service.updateGroup('system', dto as any);
  }

  @Post('system/clear-cache')
  @Roles(UserRole.OWNER)
  async clearCache() {
    await this.service.clearCache();
    return { message: 'ล้างแคชเรียบร้อยแล้ว' };
  }

  @Get('system/export')
  @Roles(UserRole.OWNER)
  async exportData(@Res() res: Response) {
    const row = await this.service.getGroup('system');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="settings-export-${Date.now()}.json"`);
    res.send(JSON.stringify(row, null, 2));
  }

  // ── Warehouses ────────────────────────────────────────────────────────────
  @Get('warehouses')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listWarehouses() { return this.service.listWarehouses(); }

  @Post('warehouses')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.service.createWarehouse(dto as any);
  }

  @Patch('warehouses/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.service.updateWarehouse(id, dto as any);
  }

  @Delete('warehouses/:id')
  @Roles(UserRole.OWNER)
  deleteWarehouse(@Param('id') id: string) {
    return this.service.deleteWarehouse(id);
  }
}
