import { Injectable } from '@nestjs/common';
import { ShopifyService } from '../types';
import { getEnvByApp } from 'src/util';
import { ShopifyRepository } from '../shopify.repository';
import { FacebookAdsRepository } from '../facebook-ads.service';

@Injectable()
export class PersoliebeService implements ShopifyService {
  readonly type = 'Persoliebe';

  readonly fb: FacebookAdsRepository;

  private readonly env = getEnvByApp('Persoliebe');

  readonly repo = new ShopifyRepository(this.type, this.env.url, this.env.sc);

  constructor() {
    const acc_id = process.env.FB_ADS_ACC_ID?.split(',');
    const tk = process.env.FB_TOKEN;

    this.fb = new FacebookAdsRepository(tk!, acc_id![1]);
  }
}
