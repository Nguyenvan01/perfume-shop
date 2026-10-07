import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Form, Input, Modal, Space } from 'antd';
import {
  CheckOutlined,
  InboxOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  RollbackOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { ordersApi } from '../../../api/orders';
import { ConfirmButton } from '../../../components';
import { useAuth } from '../../auth/AuthContext';

/** Nhãn + icon cho từng bước chuyển tiếp hợp lệ. */
const TRANSITION_UI = {
  CONFIRMED: { label: 'Xác nhận đơn', icon: <CheckOutlined />, type: 'primary' },
  PACKING: { label: 'Bắt đầu đóng gói', icon: <InboxOutlined /> },
  SHIPPING: { label: 'Giao cho vận chuyển', icon: <CarOutlined /> },
  COMPLETED: { label: 'Hoàn thành đơn', icon: <CheckCircleOutlined />, type: 'primary' },
};

/**
 * Chỉ hiện đúng những hành động backend cho phép, dựa trên
 * `allowed_transitions` mà API trả về — không tự suy luận ở frontend.
 */
export default function OrderActions({ order }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const onError = (error) => notification.error({ message: error.message });

  const statusMutation = useMutation({
    mutationFn: (status) => ordersApi.updateStatus(order.id, status),
    onSuccess: (updated) => {
      notification.success({ message: `Đơn đã chuyển sang trạng thái mới` });
      if (updated.status === 'COMPLETED') {
        notification.info({
          message: 'Đơn hoàn thành',
          description: 'Tổng chi tiêu của khách đã được cập nhật.',
        });
      }
      invalidate();
    },
    onError,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason) => ordersApi.cancel(order.id, reason),
    onSuccess: () => {
      notification.success({
        message: 'Đã hủy đơn',
        description: 'Tồn kho đã được hoàn lại.',
      });
      setCancelOpen(false);
      invalidate();
    },
    onError,
  });

  const returnMutation = useMutation({
    mutationFn: (reason) => ordersApi.processReturn(order.id, reason),
    onSuccess: () => {
      notification.success({
        message: 'Đã ghi nhận trả hàng',
        description: 'Hàng đã nhập lại kho, đơn không còn tính vào tổng chi tiêu.',
      });
      setReturnOpen(false);
      invalidate();
    },
    onError,
  });

  const paymentMutation = useMutation({
    mutationFn: (status) => ordersApi.updatePayment(order.id, status),
    onSuccess: () => {
      notification.success({ message: 'Đã cập nhật thanh toán' });
      invalidate();
    },
    onError,
  });

  const transitions = order.allowed_transitions ?? [];
  const forwardSteps = transitions.filter((status) => TRANSITION_UI[status]);
  const canCancel = transitions.includes('CANCELLED');
  const canReturn = transitions.includes('RETURNED');
  const unpaid = order.payment?.status === 'UNPAID';

  return (
    <>
      <Space wrap>
        {forwardSteps.map((status) => {
          const ui = TRANSITION_UI[status];
          return (
            <ConfirmButton
              key={status}
              type={ui.type}
              icon={ui.icon}
              title={`${ui.label}?`}
              description={
                status === 'COMPLETED'
                  ? 'Đơn hoàn thành sẽ được tính vào doanh thu và tổng chi tiêu của khách.'
                  : undefined
              }
              loading={statusMutation.isPending}
              onConfirm={() => statusMutation.mutate(status)}
            >
              {ui.label}
            </ConfirmButton>
          );
        })}

        {unpaid && (
          <ConfirmButton
            icon={<DollarOutlined />}
            title="Đánh dấu đã thanh toán?"
            loading={paymentMutation.isPending}
            onConfirm={() => paymentMutation.mutate('PAID')}
          >
            Đã thu tiền
          </ConfirmButton>
        )}

        {canCancel && (
          <Button danger icon={<CloseOutlined />} onClick={() => setCancelOpen(true)}>
            Hủy đơn
          </Button>
        )}

        {/* Xử lý trả hàng chỉ ADMIN — backend trả 403 với STAFF. */}
        {canReturn && isAdmin && (
          <Button icon={<RollbackOutlined />} onClick={() => setReturnOpen(true)}>
            Xử lý trả hàng
          </Button>
        )}

        {transitions.length === 0 && (
          <Button disabled>Đơn đã kết thúc, không còn thao tác</Button>
        )}
      </Space>

      <Modal
        open={cancelOpen}
        title="Hủy đơn hàng"
        okText="Xác nhận hủy"
        cancelText="Không hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelForm.submit()}
        destroyOnHidden
      >
        <Flex vertical gap={12}>
          <span>Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại.</span>
          <Form
            form={cancelForm}
            layout="vertical"
            onFinish={({ reason }) => cancelMutation.mutate(reason)}
          >
            <Form.Item
              name="reason"
              label="Lý do hủy"
              rules={[
                { required: true, message: 'Vui lòng nhập lý do' },
                { min: 3, message: 'Lý do quá ngắn' },
              ]}
            >
              <Input.TextArea rows={3} placeholder="Ví dụ: Khách yêu cầu hủy, hết hàng tại kho" />
            </Form.Item>
          </Form>
        </Flex>
      </Modal>

      <Modal
        open={returnOpen}
        title="Xử lý trả hàng"
        okText="Ghi nhận trả hàng"
        cancelText="Hủy"
        confirmLoading={returnMutation.isPending}
        onCancel={() => setReturnOpen(false)}
        onOk={() => returnForm.submit()}
        destroyOnHidden
      >
        <Flex vertical gap={12}>
          <span>Hàng sẽ được nhập lại kho và đơn không còn tính vào doanh thu.</span>
          <Form
            form={returnForm}
            layout="vertical"
            onFinish={({ reason }) => returnMutation.mutate(reason)}
          >
            <Form.Item
              name="reason"
              label="Lý do trả hàng"
              rules={[
                { required: true, message: 'Vui lòng nhập lý do' },
                { min: 3, message: 'Lý do quá ngắn' },
              ]}
            >
              <Input.TextArea rows={3} placeholder="Ví dụ: Khách trả vì không đúng mùi" />
            </Form.Item>
          </Form>
        </Flex>
      </Modal>
    </>
  );
}
