import { Module } from '@nestjs/common';
import { OrdersModule } from './module/orders/orders.module';
import { StatsModule } from './module/stats/stats.module';
import { PrismaService } from './prisma.service';
import { SyncModule } from './module/sync/sync.module';

@Module({
  imports: [OrdersModule, StatsModule, SyncModule],
  providers: [PrismaService],
})
export class AppModule {}
