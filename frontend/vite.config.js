import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Tách vendor thành chunk riêng (Vite 8 build bằng Rolldown → dùng `codeSplitting`
// thay cho `manualChunks` đã deprecated). Vendor ít đổi nên browser cache được lâu.
const VENDOR_GROUPS = [
  { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
  { name: 'vendor-antd-icons', test: /node_modules[\\/]@ant-design[\\/]icons/, priority: 25 },
  { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 15 },
];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && mode === 'production' && !env.VITE_API_BASE_URL) {
    // Không chặn build (CI/test vẫn build được), nhưng cảnh báo to: bản build này
    // sẽ báo lỗi cấu hình ở runtime thay vì gọi API (xem src/api/baseUrl.js).
    console.warn(
      '\n[config] VITE_API_BASE_URL is not set — this production build cannot reach the API.\n' +
        '         Set it in Vercel → Project Settings → Environment Variables and redeploy.\n'
    );
  }

  return {
    plugins: [react()],
    server: { port: 5173 },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: { groups: VENDOR_GROUPS },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
    },
  };
});
