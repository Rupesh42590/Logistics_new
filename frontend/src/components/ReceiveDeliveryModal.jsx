import { API_BASE_URL } from '../apiConfig';
import { useState } from 'react';
import axios from 'axios';
import {
    Modal,
    Table,
    InputNumber,
    Input,
    Typography,
    Tag,
    Space,
    message,
} from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function ReceiveDeliveryModal({ delivery, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState(
        delivery.items.map((item) => ({
            id: item.id,
            material_name: item.material_name,
            quantity_expected: item.quantity_expected,
            quantity_received: item.quantity_expected, // Default: full receipt
            shortage_reason: '',
        }))
    );

    const handleQuantityChange = (id, val) => {
        setItems(items.map((item) => (item.id === id ? { ...item, quantity_received: val } : item)));
    };

    const handleReasonChange = (id, val) => {
        setItems(items.map((item) => (item.id === id ? { ...item, shortage_reason: val } : item)));
    };

    const handleSubmit = async () => {
        // Validate shortages have reasons
        const shortagesWithoutReason = items.filter(
            (i) => i.quantity_received < i.quantity_expected && !i.shortage_reason
        );
        if (shortagesWithoutReason.length > 0) {
            message.error('Shortage reason is required for items with partial receipt');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                items: items.map((i) => ({
                    id: i.id,
                    quantity_received: i.quantity_received,
                    shortage_reason: i.shortage_reason || null,
                })),
            };

            await axios.post(`${API_BASE_URL}/deliveries/${delivery.id}/receive`, payload);
            message.success('Goods receipt confirmed');
            onSuccess();
        } catch (err) {
            console.error(err);
            message.error('Failed to submit receipt: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Material',
            dataIndex: 'material_name',
            key: 'material_name',
            render: (text) => <Text strong>{text}</Text>,
        },
        {
            title: 'Expected',
            dataIndex: 'quantity_expected',
            key: 'quantity_expected',
            align: 'center',
            width: 100,
        },
        {
            title: 'Received',
            key: 'quantity_received',
            align: 'center',
            width: 120,
            render: (_, record) => {
                const isShort = record.quantity_received < record.quantity_expected;
                return (
                    <InputNumber
                        min={0}
                        step={0.01}
                        value={record.quantity_received}
                        onChange={(val) => handleQuantityChange(record.id, val)}
                        size="small"
                        style={{
                            width: '100%',
                            borderColor: isShort ? '#facc15' : undefined,
                        }}
                        status={isShort ? 'error' : undefined}
                    />
                );
            },
        },
        {
            title: 'Shortage / Notes',
            key: 'shortage_reason',
            render: (_, record) => {
                const isShort = record.quantity_received < record.quantity_expected;
                return (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Input
                            placeholder={isShort ? 'Reason required...' : 'Optional notes'}
                            value={record.shortage_reason}
                            onChange={(e) => handleReasonChange(record.id, e.target.value)}
                            size="small"
                            status={isShort && !record.shortage_reason ? 'error' : undefined}
                        />
                        {isShort && (
                            <Tag icon={<WarningOutlined />} color="error" style={{ fontSize: 11 }}>
                                Short by {(record.quantity_expected - record.quantity_received).toFixed(2)}
                            </Tag>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <Modal
            open
            title={
                <div>
                    <div>Verify Goods Receipt</div>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                        PO: {delivery.po_number} • {delivery.vendor?.name}
                    </Text>
                </div>
            }
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Finalize Receipt"
            okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
            width={800}
            destroyOnClose
        >
            <Table
                columns={columns}
                dataSource={items}
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={(record) =>
                    record.quantity_received < record.quantity_expected ? 'ant-table-row-shortage' : ''
                }
                style={{ marginTop: 16 }}
            />

            <style>{`
        .ant-table-row-shortage td {
          background: #fffbeb !important;
        }
      `}</style>
        </Modal>
    );
}
