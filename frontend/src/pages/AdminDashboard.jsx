import { API_BASE_URL } from '../apiConfig';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    Timeline,
    Button,
    Spin,
    Tag,
    Space,
    Divider,
    Skeleton,
} from 'antd';
import {
    CalendarOutlined,
    WarningOutlined,
    CarOutlined,
    CheckCircleOutlined,
    AppstoreOutlined,
    TeamOutlined,
    ArrowRightOutlined,
    ClockCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        scheduled_today: 0,
        vehicles_on_site: 0,
        pending_approvals: 0,
        dock_utilization: '0/0',
        delayed_deliveries: 0,
    });
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsRes, logsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/admin/stats`),
                axios.get(`${API_BASE_URL}/admin/audit-logs`),
            ]);
            setStats(statsRes.data);
            setAuditLogs(logsRes.data);
        } catch (err) {
            console.error('Failed to fetch admin dashboard data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const statCards = [
        {
            title: 'Created Today',
            value: stats.scheduled_today,
            icon: <CalendarOutlined />,
            color: '#000000',
            bg: '#f5f5f5',
        },
        {
            title: 'Delayed Shipments',
            value: stats.delayed_deliveries || 0,
            icon: <WarningOutlined />,
            color: '#000000',
            bg: '#f5f5f5',
        },
        {
            title: 'Active Shipments',
            value: stats.vehicles_on_site, // Mapped from backend active_shipments
            icon: <CarOutlined />,
            color: '#000000',
            bg: '#f5f5f5',
        },
        {
            title: 'Pending Assign',
            value: stats.pending_approvals, // Mapped from backend pending_count
            icon: <CheckCircleOutlined />,
            color: '#000000',
            bg: '#f5f5f5',
        },
        {
            title: 'Active Drivers',
            value: stats.dock_utilization, // Mapped from backend active_drivers
            icon: <TeamOutlined />,
            color: '#000000',
            bg: '#f5f5f5',
        },
    ];

    const moduleCards = [
        {
            title: 'Operations Monitor',
            desc: 'Real-time tracking & alerts',
            icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#000000' }} />,
            path: '/admin/operations',
            color: '#f5f5f5',
        },
        {
            title: 'System Users',
            desc: 'RBAC & Role Management',
            icon: <TeamOutlined style={{ fontSize: 24, color: '#000000' }} />,
            path: '/admin/users',
            color: '#f5f5f5',
        },
        {
            title: 'Reports & Analytics',
            desc: 'Performance metrics',
            icon: <AppstoreOutlined style={{ fontSize: 24, color: '#000000' }} />,
            path: '/admin/analytics',
            color: '#f5f5f5',
        },
        {
            title: 'All Shipments',
            desc: 'Track & manage shipments',
            icon: <CarOutlined style={{ fontSize: 24, color: '#000000' }} />,
            path: '/admin/shipments',
            color: '#f5f5f5',
        },
        {
            title: 'Vehicle Fleet',
            desc: 'Manage vehicles',
            icon: <CarOutlined style={{ fontSize: 24, color: '#000000' }} />,
            path: '/admin/vehicles',
            color: '#f5f5f5',
        },

    ];

    const getTimelineColor = (action) => {
        if (action?.includes('GATE')) return 'orange';
        if (action?.includes('RECEIVED') || action?.includes('CLOSED')) return 'green';
        if (action?.includes('APPROVED')) return 'blue';
        if (action?.includes('CANCELLED')) return 'red';
        return 'blue';
    };

    if (loading) {
        return (
            <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
                <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Col xs={24} sm={12} md={8} lg={4} xl={4} key={i}>
                            <Card bordered={false}><Skeleton active avatar paragraph={false} /></Card>
                        </Col>
                    ))}
                </Row>
                <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                    <Col xs={24} lg={16}><Card bordered={false}><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
                    <Col xs={24} lg={8}><Card bordered={false}><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
                </Row>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Operations Overview</Title>
                    <Text type="secondary">Real-time logistics operations monitor</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchDashboardData}>Refresh</Button>
                    <Link to="/admin/deliveries">
                        <Button type="primary" icon={<ArrowRightOutlined />}>Manage Deliveries</Button>
                    </Link>
                </Space>
            </div>

            {/* Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {statCards.map((s, i) => (
                    <Col xs={24} sm={12} md={8} flex="1" key={i}>
                        <Card bordered={false} bodyStyle={{ padding: 20, height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 13 }}>{s.title}</Text>}
                                    value={s.value}
                                    valueStyle={{ fontSize: 28, fontWeight: 700, color: '#262626' }}
                                />
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 10,
                                        background: s.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 20,
                                        color: s.color,
                                    }}
                                >
                                    {s.icon}
                                </div>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Two Column Layout */}
            <Row gutter={[24, 24]}>
                {/* Management Modules */}
                <Col xs={24} lg={16}>
                    <Card title="Management Modules" bordered={false}>
                        <Row gutter={[16, 16]}>
                            {moduleCards.map((m, i) => (
                                <Col xs={24} sm={8} key={i}>
                                    <Link to={m.path} style={{ textDecoration: 'none' }}>
                                        <Card
                                            hoverable
                                            size="small"
                                            bodyStyle={{ padding: 20 }}
                                        >
                                            <div
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: '50%',
                                                    background: m.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                {m.icon}
                                            </div>
                                            <Text strong style={{ fontSize: 14 }}>{m.title}</Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 12 }}>{m.desc}</Text>
                                        </Card>
                                    </Link>
                                </Col>
                            ))}
                        </Row>
                    </Card>
                </Col>

                {/* Activity Feed */}
                <Col xs={24} lg={8}>
                    <Card
                        title="Recent Activity"
                        extra={<Tag color="#ff4d4f">Live Feed</Tag>}
                        bordered={false}
                        bodyStyle={{ maxHeight: 450, overflowY: 'auto', padding: '12px 20px' }}
                    >
                        {auditLogs.length === 0 ? (
                            <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 40 }}>
                                No activity recorded yet.
                            </Text>
                        ) : (
                            <Timeline
                                items={auditLogs.map((log) => ({
                                    color: getTimelineColor(log.action),
                                    children: (
                                        <div>
                                            <Text style={{ fontSize: 13 }}>{log.details}</Text>
                                            <br />
                                            <Space size={4} style={{ marginTop: 4 }}>
                                                <Tag color="default" style={{ fontSize: 11 }}>{log.user?.role}</Tag>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </Text>
                                            </Space>
                                        </div>
                                    ),
                                }))}
                            />
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
