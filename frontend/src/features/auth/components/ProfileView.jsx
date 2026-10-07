import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Tabs, Tag } from 'antd';
import { authApi } from '../../../api/auth';
import { PageHeader, QueryBoundary } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { USER_STATUS_LABEL } from '../../../utils/constants';
import ProfileForm from './ProfileForm';
import ChangePasswordForm from './ChangePasswordForm';

/** Màn hình hồ sơ dùng chung cho customer và admin, khác nhau chỉ ở layout bọc ngoài. */
export default function ProfileView() {
  const profileQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  return (
    <>
      <PageHeader title="Hồ sơ" subtitle="Thông tin tài khoản và bảo mật" />

      <QueryBoundary query={profileQuery} skeletonRows={6}>
        {(profile) => (
          <Card>
            <Tabs
              items={[
                {
                  key: 'info',
                  label: 'Thông tin',
                  children: (
                    <>
                      <Descriptions
                        column={{ xs: 1, md: 2 }}
                        style={{ marginBottom: 24 }}
                        items={[
                          { key: 'email', label: 'Email', children: profile.email },
                          {
                            key: 'roles',
                            label: 'Vai trò',
                            children: profile.roles.map((role) => (
                              <Tag key={role} color="blue">
                                {role}
                              </Tag>
                            )),
                          },
                          {
                            key: 'status',
                            label: 'Trạng thái',
                            children: (
                              <Tag color={profile.status === 'ACTIVE' ? 'green' : 'red'}>
                                {USER_STATUS_LABEL[profile.status]}
                              </Tag>
                            ),
                          },
                          {
                            key: 'created',
                            label: 'Ngày tạo',
                            children: formatDateTime(profile.created_at),
                          },
                        ]}
                      />
                      <ProfileForm profile={profile} />
                    </>
                  ),
                },
                {
                  key: 'password',
                  label: 'Đổi mật khẩu',
                  children: <ChangePasswordForm />,
                },
              ]}
            />
          </Card>
        )}
      </QueryBoundary>
    </>
  );
}
