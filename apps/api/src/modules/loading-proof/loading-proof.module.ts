import { Module } from '@nestjs/common';
import { LoadingProofController } from './loading-proof.controller';
import { LoadingProofService } from './loading-proof.service';

@Module({
  controllers: [LoadingProofController],
  providers: [LoadingProofService],
  exports: [LoadingProofService],
})
export class LoadingProofModule {}
