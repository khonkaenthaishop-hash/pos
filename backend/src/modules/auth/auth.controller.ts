// auth.controller.ts
import {
  Controller, Post, Body, Get, UseGuards, Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: { username: string; password: string }) {
    const user = await this.authService.validateUser(dto.username, dto.password);
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Verify that the caller has manager/owner privileges.
   * Used by POS to gate high-value discounts server-side
   * instead of storing the manager password in the JS bundle.
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify-manager')
  verifyManager(@CurrentUser() user: any) {
    const allowed: string[] = [UserRole.OWNER, UserRole.MANAGER];
    if (!allowed.includes(user.role)) {
      throw new UnauthorizedException('ต้องเป็นผู้จัดการหรือเจ้าของร้านเท่านั้น');
    }
    return { ok: true, role: user.role };
  }
}
