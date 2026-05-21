import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pentwo.crmapp',
  appName: '상담 CRM',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f1117',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f1117',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f1117',
    },
  },
};

export default config;
