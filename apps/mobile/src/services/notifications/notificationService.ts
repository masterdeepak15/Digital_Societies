import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '../../utils/api';
import { CHANNELS, usablePushProjectId, type AlertChannel, type LiveAlert } from './notificationModel';

let ready = false;

/**
 * Makes notifications ring and vibrate even while the app is open, and creates the Android channels
 * (a channel is where the ring and the vibration are decided, so visitors get a loud one).
 * Safe to call more than once.
 */
export async function setupNotifications(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      for (const c of Object.values(CHANNELS)) {
        await Notifications.setNotificationChannelAsync(c.id, {
          name: c.name,
          description: c.description,
          importance: c.importance as unknown as Notifications.AndroidImportance,
          vibrationPattern: c.vibration,
          enableVibrate: true,
          sound: c.sound ?? 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
        });
      }
    }
  } catch (e) {
    console.warn('[Notifications] setup failed', e);
  }
}

/** Asks the person for permission once; returns whether alerts are allowed. */
export async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch { return false; }
}

/** Rings and vibrates now (used when a live event arrives while the app is running). */
export async function showAlert(alert: LiveAlert): Promise<void> {
  try {
    await setupNotifications();
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.body,
        data: alert.data,
        sound: true,
        vibrate: CHANNELS[alert.channel].vibration,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: Platform.OS === 'android' ? { channelId: alert.channel } : null,
    });
  } catch (e) {
    console.warn('[Notifications] could not show', e);
  }
}

export const channelFor = (c: AlertChannel) => CHANNELS[c];

/**
 * Registers this phone for push notifications so alerts arrive when the app is closed.
 * Needs the app's push project id (see docs/PUSH.md); until that is set it quietly does nothing, and live
 * alerts while the app is running still work.
 */
export async function registerForPush(): Promise<'registered' | 'not-configured' | 'denied' | 'failed'> {
  try {
    const projectId = usablePushProjectId(
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId);
    if (!projectId) return 'not-configured';
    await setupNotifications();
    if (!(await ensurePermission())) return 'denied';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiFetch('/members/push-token', { method: 'POST', body: JSON.stringify({ token }) });
    return 'registered';
  } catch (e) {
    console.warn('[Notifications] push registration failed', e);
    return 'failed';
  }
}
