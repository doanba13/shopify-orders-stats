const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { FacebookAdsApi, AdAccount } = require('facebook-nodejs-business-sdk');

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(customParseFormat);

class FacebookAdsRepository {
  constructor() {
    this.api = null;
    this.adAccountId = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Facebook Ads API
   * @param {string} accessToken - Facebook access token
   * @param {string} adAccountId - Facebook ad account ID (with or without 'act_' prefix)
   * @param {string} appId - Facebook app ID
   * @param {string} appSecret - Facebook app secret
   */
  init(accessToken, adAccountId, appId, appSecret) {
    try {
      // Initialize Facebook Ads API
      FacebookAdsApi.init(accessToken, appSecret, appId);
      this.api = FacebookAdsApi.getDefaultApi();

      // Ensure ad account ID has 'act_' prefix
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

  /**
   * Check if the repository is initialized
   */
  _checkInitialization() {
    if (!this.isInitialized) {
      throw new Error(
        'Facebook Ads Repository not initialized. Call init() first.',
      );
    }
  }

  /**
   * Get ads expense by timestamp range
   * @param {number} startDate - Start date as UTC timestamp
   * @param {number} endDate - End date as UTC timestamp (optional, defaults to startDate)
   * @param {string} level - Level of breakdown ('account', 'campaign', 'adset', 'ad')
   * @param {Array} fields - Additional fields to fetch
   * @returns {Promise<Object>} Map with date as key (DD-MM-YYYY) and expense data as value
   */
  async getAdsExpense(
    startDate,
    endDate = null,
    level = 'account',
    fields = [],
  ) {
    this._checkInitialization();

    try {
      // Convert UTC timestamps to UTC dayjs objects and get day boundaries
      const startDay = dayjs.unix(startDate).utc().startOf('day');
      const endDay = endDate
        ? dayjs.unix(endDate).utc().endOf('day')
        : dayjs.unix(startDate).utc().endOf('day');

      // Convert to Facebook API date format (YYYY-MM-DD)
      const facebookStartDate = startDay.format('YYYY-MM-DD');
      const facebookEndDate = endDay.format('YYYY-MM-DD');

      // Default fields for expense data
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

      // Add level-specific fields
      const levelFields = {
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

      // Create ad account instance
      const adAccount = new AdAccount(this.adAccountId);

      // Set up insights parameters
      const params = {
        level: level,
        fields: requestFields,
        time_range: {
          since: facebookStartDate,
          until: facebookEndDate,
        },
        time_increment: 1, // Daily breakdown
        limit: 1000,
      };

      // Fetch insights
      const insights = await adAccount.getInsights([], params);

      // Process and group results by date
      const expenseMap = {};

      console.log(insights.map(e => e._data));

      for (const insight of insights) {
        const data = insight._data;
        const [y, m, d] = data.date_start.split('-');
        const date = `${d}-${m}-${y}`;

        // If date doesn't exist in map, initialize it
        if (!expenseMap[date]) {
          expenseMap[date] = {
            spend: 0,
            impressions: 0,
            clicks: 0,
            campaigns: [],
          };
        }

        // Aggregate the data
        expenseMap[date].spend += parseFloat(data.spend || 0);
        expenseMap[date].impressions += parseInt(data.impressions || 0);
        expenseMap[date].clicks += parseInt(data.clicks || 0);

        // Add campaign details if level is not 'account'
        if (level !== 'account') {
          expenseMap[date].campaigns.push({
            spend: parseFloat(data.spend || 0),
            impressions: parseInt(data.impressions || 0),
            clicks: parseInt(data.clicks || 0),
            cpc: parseFloat(data.cpc || 0),
            cpm: parseFloat(data.cpm || 0),
            ctr: parseFloat(data.ctr || 0),
            ...(data.campaign_id && { campaignId: data.campaign_id }),
            ...(data.campaign_name && { campaignName: data.campaign_name }),
            ...(data.adset_id && { adsetId: data.adset_id }),
            ...(data.adset_name && { adsetName: data.adset_name }),
            ...(data.ad_id && { adId: data.ad_id }),
            ...(data.ad_name && { adName: data.ad_name }),
            // Include any additional fields
            ...Object.keys(data)
              .filter(
                (key) =>
                  ![
                    'date_start',
                    'date_stop',
                    'spend',
                    'impressions',
                    'clicks',
                    'cpc',
                    'cpm',
                    'ctr',
                    'campaign_id',
                    'campaign_name',
                    'adset_id',
                    'adset_name',
                    'ad_id',
                    'ad_name',
                  ].includes(key),
              )
              .reduce((acc, key) => ({ ...acc, [key]: data[key] }), {}),
          });
        }
      }

      // Calculate aggregated metrics for each date
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
    } catch (error) {
      console.error('Error fetching Facebook ads expense:', error);
      throw new Error(`Failed to fetch Facebook ads expense: ${error.message}`);
    }
  }
}
const fb = new FacebookAdsRepository();

const tk =
  'EAAP27lnLyu0BPDxM7xTFZAzkC1JKtAnrSUQA0LoEAiZCkfbjq8iZCBYEmyCIN2neSHfaiuQ7wxNb03Lksr3taBlUve667dF5ZC40q8fRwIjtZAK2ZBv1SG6SZBInjiJp5dbppGC6WE2UgbwjkMxtzuyYgXIFTM0Yf1nRHJlVd7IrtKQEZBaXc1oDPVC8ZCWHq8YOQsrKrxoBnnBBPhJFHwVahN8GpvaDj3xwYQZC3D2byIGEsr6Vxq9s6BAi7TOrcZD';


fb.init(
  tk,
  process.env.FB_ADS_ACC_ID,
  process.env.FB_APP_ID,
  process.env.FB_APP_SECRET,
);

// Export singleton instance
module.exports = fb;
