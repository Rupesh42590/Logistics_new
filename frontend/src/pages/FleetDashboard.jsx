import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Statistic, Typography, Tag, Progress, Table, Button, Space, message } from 'antd';
import {
    CarOutlined, TeamOutlined, SendOutlined, CheckCircleOutlined,
    WarningOutlined, DashboardOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function FleetDashboard() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [fleetStats, setFleetStats] = useState({});
    const [shipmentStats, setShipmentStats] = useState({});
    const [loading, setLoading] = useState(true);
    const basePath = user?.role === 'FLEET_MANAGER' ? '/fleet' : '/admin';

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [fleet, shipments] = await Promise.all([
                    axios.get(`${API}/fleet/stats`, { headers }),
                    axios.get(`${API}/analytics/shipments`, { headers }),
                ]);
                setFleetStats(fleet.data);
                setShipmentStats(shipments.data);
            } catch { message.error('Failed to load fleet data'); }
            setLoading(false);
        };
        fetchData();
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Fleet Dashboard</Title>
                <Space>
                    <Button onClick={() => navigate(`${basePath}/vehicles`)}>Manage Vehicles</Button>
                    <Button onClick={() => navigate(`${basePath}/zones`)}>Manage Zones</Button>
                    <Button type="primary" onClick={() => navigate(`${basePath}/analytics`)}>View Analytics</Button>
                </Space>
            </div>

            {/* Fleet Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="Total Vehicles" value={fleetStats.total_vehicles || 0} prefix={<CarOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="Available" value={fleetStats.available || 0} /></Card>
                </Col>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="On Trip" value={fleetStats.on_trip || 0} /></Card>
                </Col>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="Maintenance" value={fleetStats.maintenance || 0} /></Card>
                </Col>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="Active Drivers" value={fleetStats.active_drivers || 0} prefix={<TeamOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={8} md={4}>
                    <Card bordered={false}><Statistic title="Total Drivers" value={fleetStats.total_drivers || 0} prefix={<TeamOutlined />} /></Card>
                </Col>
            </Row>

            {/* KPI Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                type="dashboard"
                                percent={fleetStats.utilization_rate || 0}
                                strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }}
                                size={120}
                            />
                            <div style={{ marginTop: 8 }}><Text strong>Fleet Utilization</Text></div>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false}>
                        <div style={{ textAlign: 'center' }}>
                            <Progress
                                type="dashboard"
                                percent={shipmentStats.completion_rate || 0}
                                strokeColor={{ '0%': '#fa8c16', '100%': '#52c41a' }}
                                size={120}
                            />
                            <div style={{ marginTop: 8 }}><Text strong>Shipment Completion</Text></div>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ height: '100%' }}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Statistic title="Shipments Today" value={shipmentStats.today || 0} prefix={<SendOutlined />} />
                            <Statistic title="Active Now" value={shipmentStats.active || 0} prefix={<ThunderboltOutlined />} />
                            <Statistic title="Delayed" value={shipmentStats.delayed || 0} prefix={<WarningOutlined />} />
                        </Space>
                    </Card>
                </Col>
            </Row>

            {/* Quick links */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} hoverable onClick={() => navigate(`${basePath}/operations`)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                        <DashboardOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
                        <div><Text strong>Operations Monitor</Text></div>
                        <Text type="secondary">Real-time tracking</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} hoverable onClick={() => navigate(`${basePath}/shipments`)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                        <SendOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                        <div><Text strong>All Shipments</Text></div>
                        <Text type="secondary">{(shipmentStats.active || 0) + (shipmentStats.pending || 0)} active & pending</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} hoverable onClick={() => navigate(`${basePath}/analytics`)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                        <ThunderboltOutlined style={{ fontSize: 32, color: '#722ed1', marginBottom: 8 }} />
                        <div><Text strong>Analytics</Text></div>
                        <Text type="secondary">Fleet & driver performance</Text>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
