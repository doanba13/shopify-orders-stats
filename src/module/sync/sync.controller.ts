import { Controller, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post()
  async syncBase() {
    const result = await this.syncService.syncFromCsv();
    return { message: 'Base data synced', ...result };
  }
}
