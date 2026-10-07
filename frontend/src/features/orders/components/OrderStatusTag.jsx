import { Tag } from 'antd';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '../../../utils/constants';

export default function OrderStatusTag({ status }) {
  return <Tag color={ORDER_STATUS_COLOR[status]}>{ORDER_STATUS_LABEL[status] ?? status}</Tag>;
}
