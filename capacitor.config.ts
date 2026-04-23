import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ✅ 앱 고유 ID — 나중에 플레이스토어 등록 시 이 ID 사용
  appId: 'com.pentwo.crmapp',

  // ✅ 앱 이름 (폰 화면에 표시되는 이름)
  appName: '상담 CRM',

  // React 빌드 결과물 폴더
  webDir: 'dist',

  // 번들 JS 서버 설정 (로컬 개발 시 사용, 배포 시 false)
  bundledWebRuntime: false,

  android: {
    // 통화 기록 접근을 위한 백그라운드 모드
    allowMixedContent: true,
    // 상태바 색상
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
