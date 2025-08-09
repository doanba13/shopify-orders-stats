import { Module } from '@nestjs/common';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService]
})
export class StatsModule {}
