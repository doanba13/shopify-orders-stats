import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [OrdersModule, StatsModule],
})
export class AppModule {}
