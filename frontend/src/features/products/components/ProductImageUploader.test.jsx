import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductImageUploader from './ProductImageUploader';
import { productImagesApi } from '../../../api/catalog';
import { ApiError } from '../../../api/client';

function renderUploader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <ConfigProvider>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <ProductImageUploader productId={7} images={[]} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
  const input = utils.container.querySelector('input[type="file"]');
  return { ...utils, input };
}

const png = (name, content = 'x') => new File([content], name, { type: 'image/png' });

/**
 * Tên các file đang chờ upload trong danh sách của AntD Upload. Chỉ dùng khi chưa có file
 * nào bị bỏ: item bị xoá vẫn nằm trong DOM chờ animation "leave" (jsdom không chạy animation),
 * nên trạng thái hàng chờ được kiểm tra qua nút "Tải N ảnh lên" (đếm `fileList`) và qua
 * đúng các file gửi đi ở lần thử lại.
 */
function pendingNames(container) {
  return [...container.querySelectorAll('.ant-upload-list-item-name')].map((el) => el.textContent);
}

async function selectFiles(input, files) {
  const user = userEvent.setup();
  await user.upload(input, files);
  return user;
}

// AntD Upload + user-event chậm trong jsdom, nhất là khi cả suite chạy song song.
describe('ProductImageUploader — upload theo batch', { timeout: 20000 }, () => {
  it('batch thành công thì file của batch đó rời khỏi hàng chờ', async () => {
    const upload = vi
      .spyOn(productImagesApi, 'upload')
      .mockImplementation(async (_productId, files, { onBatchUploaded }) => {
        onBatchUploaded(files, [{ id: 1 }, { id: 2 }]);
        return [{ id: 1 }, { id: 2 }];
      });
    const { input } = renderUploader();
    const user = await selectFiles(input, [png('a.png'), png('b.png')]);

    await user.click(await screen.findByRole('button', { name: /Tải 2 ảnh lên/ }));

    expect(await screen.findByText('Đã tải ảnh lên')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
    // Hàng chờ rỗng → nút tải lên biến mất.
    expect(screen.queryByRole('button', { name: /Tải .* ảnh lên/ })).not.toBeInTheDocument();
  });

  it('batch 2 lỗi → chỉ còn file của batch 2 (theo uid, kể cả trùng tên); thử lại chỉ gửi phần còn lại', async () => {
    const first = png('dup.png', 'first');
    const second = png('dup.png', 'second');
    const third = png('other.png');
    const upload = vi
      .spyOn(productImagesApi, 'upload')
      .mockImplementationOnce(async (_productId, files, { onBatchUploaded }) => {
        onBatchUploaded([files[0]], [{ id: 1 }]); // batch 1 = file đầu tiên
        throw new ApiError({ message: 'Lỗi mạng.', status: 0 }); // batch 2 hỏng
      })
      .mockResolvedValueOnce([]);
    const { container, input } = renderUploader();
    const user = await selectFiles(input, [first, second, third]);
    expect(pendingNames(container)).toEqual(['dup.png', 'dup.png', 'other.png']);

    await user.click(await screen.findByRole('button', { name: /Tải 3 ảnh lên/ }));

    // Còn đúng 2 file của batch 2 → nút đếm 2 ảnh.
    expect(await screen.findByRole('button', { name: /Tải 2 ảnh lên/ })).toBeInTheDocument();
    const notice = await screen.findByText(/Đã lưu 1\/3 ảnh, 2 ảnh chưa tải lên được/);
    const noticeBox = notice.closest('.ant-notification-notice');
    expect(within(noticeBox).getByText(/thử lại/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tải 2 ảnh lên/ }));

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    // Thử lại chỉ gửi batch 2: `dup.png` thứ hai (không bị xoá nhầm theo tên) và `other.png`.
    const retriedFiles = upload.mock.calls[1][1];
    expect(retriedFiles).toHaveLength(2);
    expect(retriedFiles[0]).not.toBe(first);
    expect(await retriedFiles[0].text()).toBe('second');
    expect(retriedFiles[1].name).toBe('other.png');
  });

  it('lỗi ngay batch đầu → giữ nguyên hàng chờ và báo lỗi gốc', async () => {
    vi.spyOn(productImagesApi, 'upload').mockRejectedValueOnce(
      new ApiError({ message: 'Ảnh không hợp lệ', status: 400 })
    );
    const { container, input } = renderUploader();
    const user = await selectFiles(input, [png('a.png'), png('b.png')]);

    await user.click(await screen.findByRole('button', { name: /Tải 2 ảnh lên/ }));

    expect(await screen.findByText('Ảnh không hợp lệ')).toBeInTheDocument();
    expect(pendingNames(container)).toEqual(['a.png', 'b.png']);
  });
});
