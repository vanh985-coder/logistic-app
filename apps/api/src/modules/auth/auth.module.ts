import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TenantService } from '../../common/tenant/tenant.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from '../../common/tenant/tenant.interceptor';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'logix3d-super-secret-jwt-key-min-32-chars-2026',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    TenantService,
    JwtAuthGuard,
    RolesGuard,
    TenantInterceptor,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    TenantService,
    JwtAuthGuard,
    RolesGuard,
    TenantInterceptor,
    JwtModule,
  ],
})
export class AuthModule {}
