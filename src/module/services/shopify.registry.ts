import { Injectable } from '@nestjs/common';
import { ParadisService } from './service/paradis.service';
import { PersoliebeService } from './service/persoliebe.service';
import { ThemuseService } from './service/thermuse.service';
import { ShopifyService, ShopifyType } from './types';

@Injectable()
export class ShopifyRegistry {
  private readonly app = new Map<ShopifyType, ShopifyService>();

  constructor(
    private paradis: ParadisService,
    private persoliebe: PersoliebeService,
    private themuse: ThemuseService,
  ) {
    this.app.set(paradis.type, paradis);
    this.app.set(persoliebe.type, persoliebe);
    this.app.set(themuse.type, themuse);
  }

  getApp(type: ShopifyType): ShopifyService | undefined {
    return this.app.get(type);
  }

  getAllApp() {
    return this.app.values();
  }
}
