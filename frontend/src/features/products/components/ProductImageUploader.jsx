import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Badge, Button, Card, Flex, Image, Upload } from 'antd';
import { UploadOutlined, StarFilled, StarOutlined, DeleteOutlined } from '@ant-design/icons';
import { productImagesApi } from '../../../api/catalog';
import { ConfirmButton, EmptyState } from '../../../components';
import { resolveImageUrl } from '../../../utils/imageUrl';

const MAX_SIZE_MB = 2;
const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Upload ảnh sản phẩm. Validate type/size ở client để không gửi request chắc
 * chắn bị backend từ chối; backend vẫn validate lại (không tin client).
 */
export default function ProductImageUploader({ productId, images, onChanged }) {
  const [fileList, setFileList] = useState([]);
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    onChanged?.();
  };

  // Số ảnh đã lưu trong lần bấm "Tải lên" hiện tại (để báo khi lỗi giữa chừng).
  const savedCountRef = useRef(0);

  /**
   * Upload theo batch: mỗi batch thành công thì bỏ ngay các file đó khỏi `fileList`
   * (theo `uid` của AntD — tên file có thể trùng), để bấm thử lại chỉ gửi phần còn lại.
   */
  const uploadMutation = useMutation({
    mutationFn: (items) => {
      savedCountRef.current = 0;
      // Map theo identity của File → uid, không dựa vào tên file.
      const uidByFile = new Map(items.map((item) => [item.originFileObj ?? item, item.uid]));
      return productImagesApi.upload(productId, [...uidByFile.keys()], {
        onBatchUploaded: (batch) => {
          savedCountRef.current += batch.length;
          const doneUids = new Set(batch.map((file) => uidByFile.get(file)));
          setFileList((prev) => prev.filter((item) => !doneUids.has(item.uid)));
        },
      });
    },
    onSuccess: () => {
      // File đã được bỏ khỏi `fileList` theo từng batch; ảnh chọn thêm trong lúc chờ vẫn giữ.
      notification.success({ message: 'Đã tải ảnh lên' });
      invalidate();
    },
    onError: (error, items) => {
      const saved = savedCountRef.current;
      if (saved > 0) {
        notification.error({
          message: `Đã lưu ${saved}/${items.length} ảnh, ${items.length - saved} ảnh chưa tải lên được`,
          description: `${error.message} Các ảnh còn lại vẫn nằm trong danh sách — bấm tải lên để thử lại.`,
        });
      } else {
        notification.error({ message: error.message });
      }
      // Batch trước có thể đã lên → làm mới danh sách ảnh.
      invalidate();
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (imageId) => productImagesApi.setPrimary(productId, imageId),
    onSuccess: () => {
      notification.success({ message: 'Đã đặt ảnh chính' });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId) => productImagesApi.remove(productId, imageId),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa ảnh' });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const beforeUpload = (file) => {
    if (!ACCEPT.split(',').includes(file.type)) {
      notification.error({ message: 'Chỉ nhận ảnh JPG, PNG hoặc WEBP' });
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      notification.error({ message: `Ảnh vượt quá ${MAX_SIZE_MB}MB` });
      return Upload.LIST_IGNORE;
    }
    // Trả false để Upload không tự gửi request — ta gửi thủ công theo batch.
    return false;
  };

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <Upload
          multiple
          accept={ACCEPT}
          maxCount={5}
          listType="picture"
          fileList={fileList}
          beforeUpload={beforeUpload}
          onChange={({ fileList: next }) => setFileList(next)}
          onRemove={(file) =>
            setFileList((prev) => prev.filter((item) => item.uid !== file.uid))
          }
        >
          <Button icon={<UploadOutlined />}>Chọn ảnh (tối đa 5, mỗi ảnh ≤ {MAX_SIZE_MB}MB)</Button>
        </Upload>

        {fileList.length > 0 && (
          <Button
            type="primary"
            loading={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate(fileList)}
          >
            Tải {fileList.length} ảnh lên
          </Button>
        )}
      </Flex>

      {images.length === 0 ? (
        <EmptyState description="Sản phẩm chưa có ảnh nào" />
      ) : (
        <Flex gap={12} wrap>
          {images.map((image) => (
            <Badge.Ribbon
              key={image.id}
              text={image.is_primary ? 'Ảnh chính' : null}
              color={image.is_primary ? 'gold' : 'transparent'}
              style={{ display: image.is_primary ? 'block' : 'none' }}
            >
              <Card
                size="small"
                style={{ width: 160 }}
                cover={
                  <Image
                    src={resolveImageUrl(image.image_url)}
                    alt={`Ảnh sản phẩm ${image.id}`}
                    height={160}
                    style={{ objectFit: 'cover' }}
                  />
                }
              >
                <Flex gap={4} justify="center">
                  <Button
                    size="small"
                    type="text"
                    icon={image.is_primary ? <StarFilled /> : <StarOutlined />}
                    disabled={image.is_primary}
                    loading={primaryMutation.isPending}
                    onClick={() => primaryMutation.mutate(image.id)}
                    title="Đặt làm ảnh chính"
                  />
                  <ConfirmButton
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    title="Xóa ảnh này?"
                    description="Ảnh sẽ bị xóa khỏi nơi lưu trữ."
                    loading={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate(image.id)}
                  />
                </Flex>
              </Card>
            </Badge.Ribbon>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
