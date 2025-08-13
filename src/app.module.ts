import { Module } from '@nestjs/common';
import { OrdersModule } from './module/orders/orders.module';
import { StatsModule } from './module/stats/stats.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [OrdersModule, StatsModule],
  providers: [PrismaService],
})
export class AppModule {}
