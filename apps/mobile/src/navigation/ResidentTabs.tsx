import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../theme/ThemeProvider';
import { RESIDENT_DETAIL, type ResidentDetail, type ResidentStackParams } from './routes';
import { TabFallback, tabIcon, useTabScreenOptions } from './tabBar';
import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from '../services/chat/chatService';
import { totalUnread } from '../screens/chat/chatModel';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<ResidentStackParams>();

const HomeScreen         = React.lazy(() => import('../screens/resident/HomeScreen'));
const BillsScreen        = React.lazy(() => import('../screens/resident/BillsScreen'));
const FeedScreen         = React.lazy(() => import('../screens/resident/FeedScreen'));
const ProfileScreen      = React.lazy(() => import('../screens/resident/ProfileScreen'));
const VisitorsScreen     = React.lazy(() => import('../screens/resident/VisitorsScreen'));
const ComplaintsScreen   = React.lazy(() => import('../screens/resident/ComplaintsScreen'));
const NoticesScreen      = React.lazy(() => import('../screens/resident/NoticesScreen'));
const FacilityScreen     = React.lazy(() => import('../screens/resident/FacilityBookingScreen'));
const ParkingScreen      = React.lazy(() => import('../screens/resident/ParkingScreen'));
const MarketplaceScreen  = React.lazy(() => import('../screens/resident/MarketplaceScreen'));
const WalletScreen       = React.lazy(() => import('../screens/resident/WalletScreen'));
const VideoCallScreen    = React.lazy(() => import('../screens/resident/VideoCallScreen'));
const SosScreen          = React.lazy(() => import('../screens/resident/SosScreen'));
const PostDetailScreen   = React.lazy(() => import('../screens/resident/PostDetailScreen'));
const CreatePostScreen   = React.lazy(() => import('../screens/resident/CreatePostScreen'));
const MarketScreen       = React.lazy(() => import('../screens/resident/MarketScreen'));
const MarketPostScreen   = React.lazy(() => import('../screens/resident/MarketPostScreen'));
const CreateMarketPostScreen = React.lazy(() => import('../screens/resident/CreateMarketPostScreen'));
const ChatListScreen      = React.lazy(() => import('../screens/chat/ChatListScreen'));
const ChatScreen          = React.lazy(() => import('../screens/chat/ChatScreen'));
const NewChatScreen       = React.lazy(() => import('../screens/chat/NewChatScreen'));
const GroupInfoScreen     = React.lazy(() => import('../screens/chat/GroupInfoScreen'));

const DETAIL: Record<ResidentDetail, { component: React.ComponentType<any>; title: string }> = {
  Visitors:    { component: VisitorsScreen,    title: 'Visitors' },
  Complaints:  { component: ComplaintsScreen,  title: 'Complaints' },
  Notices:     { component: NoticesScreen,     title: 'Notices' },
  Facilities:  { component: FacilityScreen,    title: 'Book a facility' },
  Parking:     { component: ParkingScreen,     title: 'Parking' },
  Marketplace: { component: MarketplaceScreen, title: 'Services' },
  Wallet:      { component: WalletScreen,      title: 'Wallet' },
  VideoCall:   { component: VideoCallScreen,   title: 'Call' },
  Sos:         { component: SosScreen,         title: 'SOS' },
  PostDetail:  { component: PostDetailScreen,  title: 'Post' },
  CreatePost:  { component: CreatePostScreen,  title: 'New post' },
  Market:      { component: MarketScreen,      title: 'Market' },
  MarketPost:  { component: MarketPostScreen,  title: 'Market' },
  CreateMarketPost: { component: CreateMarketPostScreen, title: 'Post to the market' },
  Chat:        { component: ChatScreen,         title: 'Chat' },
  NewChat:     { component: NewChatScreen,      title: 'New chat' },
  GroupInfo:   { component: GroupInfoScreen,    title: 'Group info' },
};

function Tabs() {
  const options = useTabScreenOptions();
  const chats = useQuery({ queryKey: ['chat-conversations'], queryFn: fetchConversations, staleTime: 30_000 });
  const unread = totalUnread(chats.data ?? []);
  return (
    <Tab.Navigator screenOptions={options}>
      <Tab.Screen name="Home"      component={HomeScreen}    options={{ title: 'Home',      tabBarIcon: tabIcon('home') }} />
      <Tab.Screen name="Bills"     component={BillsScreen}   options={{ title: 'Bills',     tabBarIcon: tabIcon('file-text') }} />
      <Tab.Screen name="Community" component={FeedScreen}    options={{ title: 'Community', tabBarIcon: tabIcon('users') }} />
      <Tab.Screen name="Chats"     component={ChatListScreen} options={{ title: 'Chats', tabBarIcon: tabIcon('message-circle'), tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tab.Screen name="Me"        component={ProfileScreen} options={{ title: 'Me',        tabBarIcon: tabIcon('user') }} />
    </Tab.Navigator>
  );
}

/** Four tabs for everyday use; every other screen opens on top with a themed back header. */
export default function ResidentTabs() {
  const { colors, fonts } = useTheme();
  return (
    <Suspense fallback={<TabFallback />}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface, shadowColor: 'transparent', elevation: 0, borderBottomColor: colors.line, borderBottomWidth: 1 },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
          headerBackTitleVisible: false,
          cardStyle: { backgroundColor: colors.ground },
        }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        {RESIDENT_DETAIL.map((name) => (
          <Stack.Screen key={name} name={name} component={DETAIL[name].component} options={{ title: DETAIL[name].title }} />
        ))}
      </Stack.Navigator>
    </Suspense>
  );
}
