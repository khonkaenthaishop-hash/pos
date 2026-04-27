import {
  Controller, Get, Post, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CashierSessionsService } from './cashier-sessions.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@ApiTags('Cashier Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cashier-sessions')
export class CashierSessionsController {
  constructor(private readonly svc: CashierSessionsService) {}

  /**
   * GET /api/v1/cashier-sessions/today
   * Returns today's session for the current user, or null if none exists.
   * Frontend calls this on POS mount to decide whether to show the open-cash modal.
   */
  @Get('today')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  getToday(@CurrentUser() user: any) {
    return this.svc.getTodaySession(user.id);
  }

  /**
   * POST /api/v1/cashier-sessions/open
   * Opens a new session for today. Returns 409 if already opened.
   */
  @Post('open')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  open(@Body() dto: OpenSessionDto, @CurrentUser() user: any) {
    return this.svc.openSession(user.id, dto);
  }

  /**
   * POST /api/v1/cashier-sessions/close
   * Closes today's open session. Returns 404 if no open session, 409 if already closed.
   */
  @Post('close')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER)
  close(@Body() dto: CloseSessionDto, @CurrentUser() user: any) {
    return this.svc.closeSession(user.id, dto);
  }

  /**
   * GET /api/v1/cashier-sessions
   * List sessions (manager/owner only), with optional ?from=&to= filters.
   */
  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listSessions(from, to);
  }
}
