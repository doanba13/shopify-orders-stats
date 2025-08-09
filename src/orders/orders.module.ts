import { Module } from '@nestjs/common';
import { OrdersService } from './orders/orders.service';
import { OrdersController } from './orders/orders.controller';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController]
})
export class OrdersModule {}
