import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Hook that fires a native local notification whenever
 * pendingCount increases (i.e. a new classroom call arrives).
 * Only active when running inside a Capacitor native shell.
 */
export function useNativeCallNotification(pendingCount: number | undefined) {
  const prevCount = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const current = pendingCount ?? 0;

    if (current > prevCount.current && prevCount.current >= 0) {
      // New call(s) arrived
      void sendNativeNotification(current);
    }

    prevCount.current = current;
  }, [pendingCount]);
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
      importance: 5, // MAX
      visibility: 1, // PUBLIC
      sound: 'beep.wav',
      vibration: true,
    });
  } catch (e) {
    console.warn('Channel creation failed:', e);
  }
}
