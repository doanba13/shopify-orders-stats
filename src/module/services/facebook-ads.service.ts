/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  FacebookAdsApi,
  AdAccount,
  type FacebookAdsApi as FacebookAdsApiType,
} from 'facebook-nodejs-business-sdk';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(customParseFormat);

export class FacebookAdsRepository {
  private api: FacebookAdsApiType;
  private adAccountId: string;
  private isInitialized: boolean;

  //   private appId: string;
  //   private appSecret: string;

  constructor(
    accessToken: string,
    adAccountId: string,
    // appId: string,
    // appSecret: string,
  ) {
    try {
      // Create a NEW API instance (independent from global default)
      this.api = new FacebookAdsApi(accessToken);
      //   this.appId = appId;
      //   this.appSecret = appSecret;

      // Ensure "act_" prefix
      this.adAccountId = adAccountId.startsWith('act_')
        ? adAccountId
        : `act_${adAccountId}`;

      this.isInitialized = true;
      console.log(
        `Facebook Ads API initialized for account: ${this.adAccountId}`,
      );
    } catch (error) {
      console.error('Failed to initialize Facebook Ads API:', error);
      throw new Error('Facebook Ads API initialization failed');
    }
  }

  private _checkInitialization(): void {
    if (!this.isInitialized || !this.api) {
      throw new Error('Facebook Ads Repository not initialized.');
    }
  }

  async getAdsExpense(
    startDate: number,
    endDate: number | null = null,
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'account',
    fields: string[] = [],
  ): Promise<Record<string, any>> {
    this._checkInitialization();

    const startDay = dayjs.unix(startDate).utc().startOf('day');
    const endDay = endDate
      ? dayjs.unix(endDate).utc().endOf('day')
      : dayjs.unix(startDate).utc().endOf('day');

    const facebookStartDate = startDay.format('YYYY-MM-DD');
    const facebookEndDate = endDay.format('YYYY-MM-DD');

    const defaultFields = [
      'spend',
      'impressions',
      'clicks',
      'cpc',
      'cpm',
      'ctr',
      'date_start',
      'date_stop',
    ];

    const levelFields: Record<string, string[]> = {
      campaign: ['campaign_id', 'campaign_name'],
      adset: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name'],
      ad: [
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'ad_id',
        'ad_name',
      ],
    };

    const requestFields = [
      ...defaultFields,
      ...(levelFields[level] || []),
      ...fields,
    ];

    const adAccount = new AdAccount(this.adAccountId, this.api);

    const params = {
      level,
      fields: requestFields,
      time_range: { since: facebookStartDate, until: facebookEndDate },
      time_increment: 1,
      limit: 1000,
    };

    const insights = await adAccount.getInsights([], params);
    const expenseMap: Record<string, any> = {};

    for (const insight of insights) {
      const data = insight._data;
      const [y, m, d] = data.date_start.split('-') || [];
      const date = `${d}-${m}-${y}`;

      if (!expenseMap[date]) {
        expenseMap[date] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          campaigns: [],
        };
      }

      expenseMap[date].spend += parseFloat(data.spend || '0');
      expenseMap[date].impressions += parseInt(data.impressions || '0');
      expenseMap[date].clicks += parseInt(data.clicks || '0');

      if (level !== 'account') {
        expenseMap[date].campaigns.push({
          spend: parseFloat(data.spend || '0'),
          impressions: parseInt(data.impressions || '0'),
          clicks: parseInt(data.clicks || '0'),
          cpc: parseFloat(data.cpc || '0'),
          cpm: parseFloat(data.cpm || '0'),
          ctr: parseFloat(data.ctr || '0'),
          ...(data.campaign_id && { campaignId: data.campaign_id }),
          ...(data.campaign_name && { campaignName: data.campaign_name }),
          ...(data.adset_id && { adsetId: data.adset_id }),
          ...(data.adset_name && { adsetName: data.adset_name }),
          ...(data.ad_id && { adId: data.ad_id }),
          ...(data.ad_name && { adName: data.ad_name }),
        });
      }
    }

    for (const date in expenseMap) {
      const dayData = expenseMap[date];
      expenseMap[date] = {
        ...dayData,
        cpc: dayData.clicks > 0 ? dayData.spend / dayData.clicks : 0,
        cpm:
          dayData.impressions > 0
            ? (dayData.spend / dayData.impressions) * 1000
            : 0,
        ctr:
          dayData.impressions > 0
            ? (dayData.clicks / dayData.impressions) * 100
            : 0,
      };
    }

    return expenseMap;
  }
}
