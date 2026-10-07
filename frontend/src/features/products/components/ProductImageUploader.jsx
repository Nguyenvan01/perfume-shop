import { useState } from 'react';
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

  const uploadMutation = useMutation({
    mutationFn: (files) => productImagesApi.upload(productId, files),
    onSuccess: () => {
      notification.success({ message: 'Đã tải ảnh lên' });
      setFileList([]);
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
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
            onClick={() =>
              uploadMutation.mutate(fileList.map((item) => item.originFileObj ?? item))
            }
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
