import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Table, Tag, Typography, Space, Spin, Statistic, Row, Col, message, Empty } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CarOutlined, EnvironmentOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    PENDING: 'gold', ASSIGNED: 'blue', PICKED_UP: 'cyan',
    IN_TRANSIT: 'processing', DELIVERED: 'green', CONFIRMED: 'success', CANCELLED: 'red',
};

export default function DriverHistory() {
    const { token } = useAuth();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API}/shipments`, { headers });
                // Filter only completed shipments
                const completed = res.data.filter(s =>
                    ['DELIVERED', 'CONFIRMED'].includes(s.status)
                );
                setShipments(completed);
            } catch {
                message.error('Failed to load delivery history');
            }
            setLoading(false);
        };
        fetchHistory();
    }, []);

    const columns = [
        {
            title: 'Tracking ID',
            dataIndex: 'tracking_id',
            key: 'tracking_id',
            render: (text) => <Text strong style={{ fontFamily: 'monospace' }}>{text || '-'}</Text>,
        },
        {
            title: 'From',
            dataIndex: 'pickup_address',
            key: 'from',
            render: (text) => text || '-',
            ellipsis: true,
        },
        {
            title: 'To',
            dataIndex: 'delivery_address',
            key: 'to',
            render: (text) => text || '-',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => <Tag color={STATUS_COLORS[status] || 'default'}>{status?.replace('_', ' ')}</Tag>,
        },
        {
            title: 'Delivered On',
            dataIndex: 'updated_at',
            key: 'delivered',
            render: (val) => val ? new Date(val).toLocaleDateString() : '-',
            sorter: (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
        },
    ];

    const totalDelivered = shipments.length;
    const confirmedCount = shipments.filter(s => s.status === 'CONFIRMED').length;

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Delivery History</Title>
                <Text type="secondary">Your past completed deliveries</Text>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="Total Delivered"
                            value={totalDelivered}
                            prefix={<CarOutlined />}
                            valueStyle={{ color: 'inherit' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="Confirmed"
                            value={confirmedCount}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: 'inherit' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card bordered={false} style={{ borderRadius: 8 }}>
                        <Statistic
                            title="Pending Confirmation"
                            value={totalDelivered - confirmedCount}
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: 'inherit' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={shipments}
                rowKey="id"
                loading={loading}
                locale={{ emptyText: <Empty description="No deliveries yet" /> }}
                pagination={false}
                size="middle"
                bordered
                style={{ background: '#fff', borderRadius: 8 }}
            />
        </div>
    );
}
