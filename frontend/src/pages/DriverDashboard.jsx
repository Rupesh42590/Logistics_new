import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Statistic, Table, Tag, Button, Typography, Space, message, Spin } from 'antd';
import { CarOutlined, CheckCircleOutlined, ClockCircleOutlined, SendOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    PENDING: 'gold', ASSIGNED: 'blue', PICKED_UP: 'cyan',
    IN_TRANSIT: 'processing', DELIVERED: 'green', CONFIRMED: 'success', CANCELLED: 'red',
};

export default function DriverDashboard() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({});
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, shipmentsRes] = await Promise.all([
                axios.get(`${API}/driver/dashboard`, { headers }),
                axios.get(`${API}/shipments`, { headers }),
            ]);
            setStats(statsRes.data);
            setShipments(shipmentsRes.data);
        } catch { message.error('Failed to load driver data'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleAction = async (id, action) => {
        setActionLoading(id);
        try {
            if (action === 'deliver') {
                navigate(`/driver/shipments/${id}`);
                return;
            }
            await axios.post(`${API}/shipments/${id}/${action}`, {}, { headers });
            message.success('Status updated!');
            fetchData();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Action failed');
        }
        setActionLoading(null);
    };

    const columns = [
        {
            title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking',
            render: (t, r) => <a onClick={() => navigate(`/driver/shipments/${r.id}`)}>{t}</a>
        },
        { title: 'Pickup', dataIndex: 'pickup_address', key: 'pickup', ellipsis: true },
        { title: 'Drop', dataIndex: 'drop_address', key: 'drop', ellipsis: true },
        { title: 'Weight', dataIndex: 'total_weight', key: 'weight', render: v => `${v} kg`, width: 90 },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 120,
            render: s => <Tag color={STATUS_COLORS[s]}>{s.replace(/_/g, ' ')}</Tag>
        },
        {
            title: 'Action', key: 'action', width: 140,
            render: (_, r) => {
                if (r.status === 'ASSIGNED') return <Button size="small" type="primary" loading={actionLoading === r.id} onClick={() => handleAction(r.id, 'pickup')}>Pick Up</Button>;
                if (r.status === 'PICKED_UP') return <Button size="small" type="primary" loading={actionLoading === r.id} onClick={() => handleAction(r.id, 'in-transit')}>Start Transit</Button>;
                if (r.status === 'IN_TRANSIT') return <Button size="small" type="primary" style={{ background: '#52c41a' }} onClick={() => handleAction(r.id, 'deliver')}>Deliver</Button>;
                return <Tag>{r.status}</Tag>;
            },
        },
    ];

    const activeShipments = shipments.filter(s => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(s.status));
    const completedShipments = shipments.filter(s => ['DELIVERED', 'CONFIRMED'].includes(s.status));

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>Driver Dashboard</Title>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card bordered={false}>
                        <Statistic title="Active Shipments" value={stats.active_shipments || 0} prefix={<SendOutlined />} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}>
                        <Statistic title="Completed Today" value={stats.completed_today || 0} prefix={<CheckCircleOutlined />} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}>
                        <Statistic title="Total Completed" value={stats.total_completed || 0} prefix={<DashboardOutlined />} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}>
                        {stats.vehicle ? (
                            <div>
                                <Statistic title="Vehicle" value={stats.vehicle.name} prefix={<CarOutlined />} valueStyle={{ fontSize: 18 }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>{stats.vehicle.plate_number}</Text>
                            </div>
                        ) : (
                            <Statistic title="Vehicle" value="None Assigned" prefix={<CarOutlined />} valueStyle={{ fontSize: 16 }} />
                        )}
                    </Card>
                </Col>
            </Row>

            <Card title={`Active Shipments (${activeShipments.length})`} bordered={false} style={{ marginBottom: 24 }}>
                <Table columns={columns} dataSource={activeShipments} rowKey="id" loading={loading} pagination={false} size="middle" />
            </Card>

            <Card title={`Completed (${completedShipments.length})`} bordered={false}>
                <Table
                    columns={columns.filter(c => c.key !== 'action')}
                    dataSource={completedShipments}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                />
            </Card>
        </div>
    );
}
