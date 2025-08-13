import { ShopifyType } from 'src/module/services/types';

export function getEnvByApp(app: ShopifyType): { sc: string; url: string } {
  const secret = process.env.SHOPIFY_SECRET?.split(',');
  const url = process.env.SHOPIFY_URL?.split(',');

  if (app == 'Paradis') return { sc: secret![0], url: url![0] };
  if (app == 'Persoliebe') return { sc: secret![1], url: url![1] };
  return { sc: secret![2], url: url![2] };
}
