import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantService } from '../../../common/tenant/tenant.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tenantContext = await this.tenantService.resolveTenantContext(payload.sub);
    if (!tenantContext) {
      throw new UnauthorizedException('User account not found');
    }

    if (tenantContext.userStatus === 'BLOCKED' || tenantContext.userStatus === 'INACTIVE') {
      throw new ForbiddenException('User account is inactive or blocked');
    }

    if (tenantContext.companyStatus === 'SUSPENDED') {
      throw new ForbiddenException('Company account is suspended');
    }

    if (tenantContext.companyStatus === 'REJECTED') {
      throw new ForbiddenException('Company registration was rejected');
    }

    request.user = {
      userId: tenantContext.userId,
      companyId: tenantContext.companyId,
      role: tenantContext.role,
      email: payload.email,
      userStatus: tenantContext.userStatus,
      companyStatus: tenantContext.companyStatus,
    };

    return true;
  }
}
