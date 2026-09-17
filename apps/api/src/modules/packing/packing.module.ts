import { Module } from '@nestjs/common';
import { PackingService } from './packing.service';
import { PackingController } from './packing.controller';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [PackingController],
  providers: [PackingService],
  exports: [PackingService],
})
export class PackingModule {}
