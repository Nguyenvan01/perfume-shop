import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Space, Tag, Tooltip } from 'antd';
import { PlusOutlined, SafetyOutlined, DeleteOutlined } from '@ant-design/icons';
import { rolesApi, permissionsApi } from '../../api/users';
import { PageHeader, DataTable, ErrorState, ConfirmButton } from '../../components';
import RoleFormModal from '../../features/roles/components/RoleFormModal';

export default function RolesPage() {
  const [modal, setModal] = useState({ open: false, role: null });
  const { notification } = App.useApp();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    // Quyền đổi thì /auth/me của chính mình cũng có thể đổi.
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => rolesApi.remove(id),
    onSuccess: () => {
      notification.success({ message: 'Đã xóa vai trò' });
      invalidate();
    },
    onError: (error) => notification.error({ message: error.message }),
  });

  const columns = [
    {
      title: 'Vai trò',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <strong>{name}</strong>
          {record.is_system && (
            <Tooltip title="Vai trò hệ thống, không thể xóa">
              <Tag color="gold">hệ thống</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (v) => v || '—' },
    {
      title: 'Số người dùng',
      dataIndex: 'user_count',
      key: 'user_count',
      align: 'right',
    },
    {
      title: 'Quyền',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions) =>
        permissions.length === 0 ? (
          <Tag>chưa có quyền</Tag>
        ) : (
          <Tooltip title={permissions.join(', ')}>
            <Tag color="blue">{permissions.length} quyền</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<SafetyOutlined />}
            onClick={() => setModal({ open: true, role: record })}
          >
            Phân quyền
          </Button>
          <ConfirmButton
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={record.is_system || record.user_count > 0}
            title="Xóa vai trò này?"
            description="Chỉ xóa được vai trò tự tạo và chưa gán cho ai."
            loading={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            Xóa
          </ConfirmButton>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vai trò & quyền"
        subtitle="Phân quyền theo vai trò. Backend luôn kiểm tra lại quyền, giao diện chỉ hỗ trợ hiển thị."
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModal({ open: true, role: null })}
          >
            Thêm vai trò
          </Button>
        }
      />

      {rolesQuery.isError ? (
        <ErrorState error={rolesQuery.error} onRetry={rolesQuery.refetch} />
      ) : (
        <DataTable
          columns={columns}
          dataSource={rolesQuery.data ?? []}
          loading={rolesQuery.isFetching}
          emptyDescription="Chưa có vai trò nào"
        />
      )}

      <RoleFormModal
        open={modal.open}
        role={modal.role}
        permissions={permissionsQuery.data ?? []}
        onClose={() => setModal({ open: false, role: null })}
        onSuccess={invalidate}
      />
    </>
  );
}
