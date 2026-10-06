import { ConfigProvider, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

import { router } from './routes';
import { AuthProvider } from './features/auth/AuthContext';

dayjs.locale('vi');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const theme = {
  token: {
    colorPrimary: '#8c5a3b',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
};

export default function App() {
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
