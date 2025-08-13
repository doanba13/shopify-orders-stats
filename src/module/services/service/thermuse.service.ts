import { Injectable } from '@nestjs/common';
import { ShopifyService } from '../types';
import { getEnvByApp } from 'src/util';
import { ShopifyRepository } from '../shopify.repository';
import { FacebookAdsRepository } from '../facebook-ads.service';

@Injectable()
export class ThemuseService implements ShopifyService {
  readonly type = 'Thermuse';

  private readonly env = getEnvByApp('Thermuse');

  readonly fb: FacebookAdsRepository;

  readonly repo = new ShopifyRepository(this.type, this.env.url, this.env.sc);
}
