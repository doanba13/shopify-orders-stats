import { Module } from '@nestjs/common';
import { PersoliebeService } from './service/persoliebe.service';
import { ThemuseService } from './service/thermuse.service';
import { ParadisService } from './service/paradis.service';
import { ShopifyRegistry } from './shopify.registry';

@Module({
  providers: [
    PersoliebeService,
    ThemuseService,
    ParadisService,
    ShopifyRegistry,
  ],
  exports: [ShopifyRegistry],
})
export class ServicesModule {}
