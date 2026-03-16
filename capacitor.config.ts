import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9c25c02cb1fb4d21be2a9079016fc469',
  appName: 'vegsystem',
  webDir: 'dist',
  server: {
    url: 'https://9c25c02c-b1fb-4d21-be2a-9079016fc469.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#CE0303',
      sound: 'beep.wav',
    },
  },
};

export default config;
