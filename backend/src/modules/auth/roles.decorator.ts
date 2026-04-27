// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
