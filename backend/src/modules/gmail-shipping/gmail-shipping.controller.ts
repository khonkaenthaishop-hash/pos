import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GmailService } from './gmail.service';
import { ShippingSyncService } from './shipping-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Gmail Shipping')
@Controller('gmail-shipping')
export class GmailShippingController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly syncService: ShippingSyncService,
  ) {}

  // ─── OAuth2 — Get auth URL ─────────────────────────────────────────
  @Get('auth/url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get Gmail OAuth2 authorization URL' })
  async getAuthUrl() {
    const url = await this.gmailService.getAuthUrl();
    return { url };
  }

  // ─── OAuth2 — Callback (public, called by Google) ─────────────────
  @Get('auth/callback')
  @ApiOperation({ summary: 'OAuth2 callback — called by Google (no auth required)' })
  async exchangeCode(@Query('code') code: string) {
    if (!code) {
      return { success: false, message: 'Missing authorization code' };
    }
    await this.gmailService.exchangeCodeForTokens(code);
    return { success: true, message: 'Gmail connected successfully' };
  }

  // ─── Connection status ─────────────────────────────────────────────
  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get Gmail connection status' })
  getConnectionStatus() {
    return this.gmailService.getConnectionStatus();
  }

  // ─── Disconnect ────────────────────────────────────────────────────
  @Delete('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect Gmail account' })
  async disconnectGmail() {
    await this.gmailService.disconnectGmail();
  }

  // ─── Manual sync trigger ───────────────────────────────────────────
  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Trigger manual Gmail sync' })
  triggerManualSync() {
    return this.syncService.triggerManualSync();
  }

  // ─── Dashboard ─────────────────────────────────────────────────────
  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get shipping dashboard data for a date' })
  getDashboardData(@Query('date') date: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    return this.syncService.getDashboardData(targetDate);
  }

  // ─── Unmatched emails — must come BEFORE :id routes ───────────────
  @Get('emails/unmatched')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get unmatched shipping emails' })
  getUnmatchedEmails() {
    return this.syncService.getUnmatchedEmails();
  }

  // ─── Confirm email ─────────────────────────────────────────────────
  @Patch('emails/:id/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Admin confirm a shipping email' })
  confirmEmail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.syncService.confirmEmail(id, user.id);
  }

  // ─── Manual match ──────────────────────────────────────────────────
  @Patch('emails/:id/match')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Manually match a shipping email to a POS order' })
  manualMatch(
    @Param('id') id: string,
    @Body('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.syncService.manualMatch(id, orderId, user.id);
  }
}
