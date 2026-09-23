import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { pinoConfig } from './common/logger/pino.config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { UserModule } from './modules/user/user.module';
import { LaneModule } from './modules/lane/lane.module';
import { ShipmentModule } from './modules/shipment/shipment.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PackingModule } from './modules/packing/packing.module';
import { QuoteModule } from './modules/quote/quote.module';
import { StorageModule } from './modules/storage/storage.module';
import { LoadingProofModule } from './modules/loading-proof/loading-proof.module';
import { CfsModule } from './modules/cfs/cfs.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';

@Module({
  imports: [
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CompanyModule,
    UserModule,
    LaneModule,
    ShipmentModule,
    MatchingModule,
    PackingModule,
    QuoteModule,
    StorageModule,
    LoadingProofModule,
    CfsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}

