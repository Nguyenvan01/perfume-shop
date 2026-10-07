import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from './LoginForm';
import * as authContext from '../AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderForm(login) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({ login });
  return render(
    <ConfigProvider>
      <AntdApp>
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('LoginForm — validation', () => {
  it('submit rỗng → hiện lỗi bắt buộc, không gọi API', async () => {
    const login = vi.fn();
    renderForm(login);

    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Vui lòng nhập email')).toBeInTheDocument();
    expect(await screen.findByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('email sai định dạng → chặn ở client, không gọi API', async () => {
    const login = vi.fn();
    renderForm(login);

    await userEvent.type(screen.getByPlaceholderText('email@example.com'), 'khong-phai-email');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});

describe('LoginForm — điều hướng sau đăng nhập', () => {
  it('ADMIN vào /admin', async () => {
    const login = vi.fn().mockResolvedValue({ full_name: 'Quản trị', roles: ['ADMIN'] });
    renderForm(login);

    await userEvent.type(screen.getByPlaceholderText('email@example.com'), 'admin@test.local');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true })
    );
  });

  it('CUSTOMER về trang khách', async () => {
    const login = vi.fn().mockResolvedValue({ full_name: 'Khách', roles: ['CUSTOMER'] });
    renderForm(login);

    await userEvent.type(screen.getByPlaceholderText('email@example.com'), 'cus@test.local');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('login lỗi → không điều hướng', async () => {
    const login = vi.fn().mockRejectedValue({ message: 'Invalid credentials', errors: [] });
    renderForm(login);

    await userEvent.type(screen.getByPlaceholderText('email@example.com'), 'admin@test.local');
    await userEvent.type(screen.getByPlaceholderText('Mật khẩu'), 'SaiMatKhau1');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
