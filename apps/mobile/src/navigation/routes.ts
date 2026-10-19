/** Route names for the role navigators. Residents get 5 tabs (chat is one of them); everything else is a stack screen. */
export const RESIDENT_TABS = ['Home', 'Bills', 'Community', 'Chats', 'Me'] as const;

export const RESIDENT_DETAIL = [
  'Visitors', 'Complaints', 'Notices', 'Facilities', 'Parking', 'Marketplace', 'Wallet', 'VideoCall', 'Sos',
  'PostDetail', 'CreatePost', 'Market', 'MarketPost', 'CreateMarketPost',
  'Chat', 'NewChat', 'GroupInfo',
] as const;

export const GUARD_TABS = ['Gate', 'Log', 'Sos', 'Me'] as const;

export type ResidentTab = (typeof RESIDENT_TABS)[number];
export type ResidentDetail = (typeof RESIDENT_DETAIL)[number];

export type ResidentStackParams = { Tabs: undefined } & Record<ResidentDetail, undefined>;
export type GuardTabParams = Record<(typeof GUARD_TABS)[number] | 'Delivery', undefined>;
