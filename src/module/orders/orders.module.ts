import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderRepository } from './order.repository';
import { ServicesModule } from '../services/service.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [ServicesModule],
  providers: [OrdersService, OrderRepository, PrismaService],
  controllers: [OrdersController],
})
export class OrdersModule {}
