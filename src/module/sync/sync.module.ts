import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SyncController],
  providers: [PrismaService, SyncService],
})
export class SyncModule {}
