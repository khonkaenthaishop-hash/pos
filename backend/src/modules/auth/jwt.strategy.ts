// jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const userId = payload?.sub;
    if (!userId) throw new UnauthorizedException('Invalid token');

    try {
      const user = await this.usersService.findById(userId);
      if (!user.isActive) throw new UnauthorizedException('User is inactive');
      return { id: user.id, username: user.username, role: user.role };
    } catch {
      throw new UnauthorizedException('User not found');
    }
  }
}
