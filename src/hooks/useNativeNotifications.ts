import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Fires automatic notifications whenever pendingCount increases.
 * - Native shell: local notification with custom sound channel
 * - Browser/PWA: Web Notification (system-level)
 */
export function useNativeCallNotification(pendingCount: number | undefined) {
  const prevCount = useRef<number>(0);

  useEffect(() => {
    const current = pendingCount ?? 0;

    if (current > prevCount.current && prevCount.current >= 0) {
      void sendCallNotification(current);
    }

    prevCount.current = current;
  }, [pendingCount]);
}

async function sendCallNotification(count: number) {
  if (Capacitor.isNativePlatform()) {
    await sendNativeNotification(count);
    return;
  }

  await sendWebNotification(count);
}

async function sendNativeNotification(count: number) {
  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title: 'Novo Chamado de Sala!',
          body: `Há ${count} chamado${count > 1 ? 's' : ''} pendente${count > 1 ? 's' : ''}. Toque para atender.`,
          sound: 'beep.wav',
          smallIcon: 'ic_stat_icon_config_sample',
          largeIcon: 'ic_launcher',
          channelId: 'classroom-calls',
        },
      ],
    });
  } catch (e) {
    console.warn('Native notification failed:', e);
  }
}

async function sendWebNotification(count: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  try {
    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') return;

    const notification = new Notification('🔔 Novo Chamado de Sala!', {
      body: `Há ${count} chamado${count > 1 ? 's' : ''} pendente${count > 1 ? 's' : ''}. Abra o módulo para atender.`,
      tag: 'classroom-calls',
      icon: '/pwa-192x192.png',
      requireInteraction: true, // Keep notification visible until user interacts
      silent: false,
    });

    window.setTimeout(() => notification.close(), 15000);
  } catch (e) {
    console.warn('Web notification failed:', e);
  }
}

/**
 * Call once on app startup (inside a native shell) to create
 * the notification channel with sound enabled.
 */
export async function setupNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: 'classroom-calls',
      name: 'Chamados de Sala',
      description: 'Alertas sonoros para novos chamados de sala',
      importance: 5,
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
    });
  } catch (e) {
    console.warn('Channel creation failed:', e);
  }
}
