import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pentwo.crmapp',
  appName: '상담 CRM',
  webDir: 'dist',

  // 웹앱을 Render 서버에서 로드 (앱 업데이트 시 APK 재배포 불필요)
  server: {
    url: 'https://crm-app-sj7m.onrender.com',
    cleartext: false,
  },

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
