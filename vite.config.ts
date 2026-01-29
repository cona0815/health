import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    // 關鍵：使用相對路徑，這樣拖曳到 Netlify 或丟到 GitHub Pages 都不會白畫面
    base: './', 
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
    },
    define: {
      // 傳遞環境變數，但如果沒有設定也不會報錯，改由前端輸入
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
  };
});