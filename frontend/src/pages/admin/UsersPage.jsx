import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Input, Select, Space, Tag } from 'antd';
import { PlusOutlined, LockOutlined, UnlockOutlined, KeyOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { usersApi, rolesApi } from '../../api/users';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import { formatDateTime } from '../../utils/format';
import { USER_STATUS_LABEL } from '../../utils/constants';
import { useAuth } from '../../features/auth/AuthContext';
import UserFormModal from '../../features/users/components/UserFormModal';
import ResetPasswordModal from '../../features/users/components/ResetPasswordModal';

const ROLE_COLOR = { ADMIN: 'red', STAFF: 'blue', CUSTOMER: 'green' };

export default function UsersPage() {
  const [params, setParams] = useState({ page: 1, limit: 10, q: '', role: undefined, status: undefined });
  const [formModal, setFormModal] = useState({ open: false, user: null });
  const [resetModal, setResetModal] = useState({ open: false, user: null });

  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const usersQuery = useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.list(params),
  });

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => usersApi.setStatus(id, status),
    onSuccess: (_data, variables) => {
      notification.success({
        message: variables.status === 'LOCKED' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
      });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa người dùng' });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Họ và tên', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone', render: (value) => value || '—' },
    {
      title: 'Vai trò',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles) => roles.map((role) => <Tag key={role} color={ROLE_COLOR[role]}>{role}</Tag>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{USER_STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, record) => {
        // Backend chặn tự khóa/xóa chính mình (409) — ẩn nút luôn cho khỏi bấm vô ích.
        const isSelf = record.id === currentUser?.id;
        const isLocked = record.status === 'LOCKED';

        return (
          <Space size={4} wrap>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setFormModal({ open: true, user: record })}
            >
              Sửa
            </Button>
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => setResetModal({ open: true, user: record })}
            >
              Mật khẩu
            </Button>
            <ConfirmButton
              size="small"
              icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
              danger={!isLocked}
              disabled={isSelf}
              title={isLocked ? 'Mở khóa tài khoản này?' : 'Khóa tài khoản này?'}
              description={
                isLocked
                  ? 'Người dùng sẽ đăng nhập lại được.'
                  : 'Mọi phiên đăng nhập hiện tại sẽ bị thu hồi.'
              }
              loading={statusMutation.isPending}
              onConfirm={() =>
                statusMutation.mutate({ id: record.id, status: isLocked ? 'ACTIVE' : 'LOCKED' })
              }
            >
              {isLocked ? 'Mở khóa' : 'Khóa'}
            </ConfirmButton>
            <ConfirmButton
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={isSelf}
              title="Xóa người dùng này?"
              description="Dữ liệu được xóa mềm, tài khoản không đăng nhập được nữa."
              loading={deleteMutation.isPending}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              Xóa
            </ConfirmButton>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý người dùng"
        subtitle="Tài khoản, vai trò và trạng thái truy cập"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFormModal({ open: true, user: null })}
          >
            Thêm người dùng
          </Button>
        }
      />

      <Flex gap={12} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo email, tên, số điện thoại"
          allowClear
          style={{ maxWidth: 320 }}
          onSearch={(value) => setParams((prev) => ({ ...prev, q: value, page: 1 }))}
        />
        <Select
          placeholder="Vai trò"
          allowClear
          style={{ width: 160 }}
          options={['ADMIN', 'STAFF', 'CUSTOMER'].map((role) => ({ value: role, label: role }))}
          onChange={(value) => setParams((prev) => ({ ...prev, role: value, page: 1 }))}
        />
        <Select
          placeholder="Trạng thái"
          allowClear
          style={{ width: 180 }}
          options={Object.entries(USER_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setParams((prev) => ({ ...prev, status: value, page: 1 }))}
        />
      </Flex>

      {usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={usersQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={usersQuery.data?.items ?? []}
          meta={usersQuery.data?.meta}
          loading={usersQuery.isFetching}
          emptyDescription="Không tìm thấy người dùng nào"
          onChangePage={(page, limit) => setParams((prev) => ({ ...prev, page, limit }))}
        />
      )}

      <UserFormModal
        open={formModal.open}
        user={formModal.user}
        roles={rolesQuery.data ?? []}
        onClose={() => setFormModal({ open: false, user: null })}
        onSuccess={invalidate}
      />

      <ResetPasswordModal
        open={resetModal.open}
        user={resetModal.user}
        onClose={() => setResetModal({ open: false, user: null })}
      />
    </>
  );
}
