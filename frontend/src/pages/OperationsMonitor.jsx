import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Tag, Table, Typography, Badge, Statistic, Space, Button, message, Spin, Tabs } from 'antd';
import { ReloadOutlined, SendOutlined, CarOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    PENDING: 'gold', ASSIGNED: 'blue', PICKED_UP: 'cyan',
    IN_TRANSIT: 'processing', DELIVERED: 'green', CONFIRMED: 'success', CANCELLED: 'red',
};

export default function OperationsMonitor() {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [alerts, setAlerts] = useState({ delayed_shipments: [], capacity_warnings: [] });
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
        try {
            const [opsRes, alertRes, auditRes] = await Promise.all([
                axios.get(`${API}/operations/dashboard`, { headers }),
                axios.get(`${API}/admin/alerts`, { headers }),
                axios.get(`${API}/admin/audit-logs?limit=50`, { headers })
            ]);
            setData(opsRes.data);
            setAlerts(alertRes.data);
            setAuditLogs(auditRes.data);
        } catch { message.error('Failed to load operations data'); }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        intervalRef.current = setInterval(fetchData, 30000); // Auto-refresh every 30s
        return () => clearInterval(intervalRef.current);
    }, []);

    if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

    const activeShipments = data?.active_shipments || [];
    const vehicleStatus = data?.vehicle_status || {};
    const zoneActivity = data?.zone_activity || [];

    const shipmentColumns = [
        {
            title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking',
            render: t => <Text strong style={{ fontFamily: 'monospace' }}>{t}</Text>
        },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: s => <Tag color={STATUS_COLORS[s]}>{s.replace(/_/g, ' ')}</Tag>
        },
        { title: 'Pickup', dataIndex: 'pickup_address', key: 'pickup', ellipsis: true },
        { title: 'Drop', dataIndex: 'drop_address', key: 'drop', ellipsis: true },
        {
            title: 'Driver', dataIndex: 'assigned_driver_id', key: 'driver',
            render: v => v ? `Driver #${v}` : <Text type="secondary">Unassigned</Text>
        },
        {
            title: 'Updated', dataIndex: 'updated_at', key: 'updated',
            render: d => d ? new Date(d).toLocaleTimeString() : '-'
        },
    ];

    const auditColumns = [
        { title: 'Time', dataIndex: 'timestamp', key: 'time', width: 180, render: t => new Date(t).toLocaleString() },
        { title: 'User', dataIndex: ['user', 'name'], key: 'user', width: 150, render: (n, r) => n || `User #${r.user_id}` },
        { title: 'Action', dataIndex: 'action', key: 'action', width: 200, render: a => <Tag color="blue">{a}</Tag> },
        { title: 'Entity', dataIndex: 'entity_type', key: 'entity', width: 120, render: (t, r) => <Text type="secondary">{t} #{r.entity_id}</Text> },
        { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true },
    ];

    const delayedShipments = alerts.delayed_shipments || [];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Space>
                    <Title level={3} style={{ margin: 0 }}>Operations Monitor</Title>
                    <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 12 }}>Live · Auto-refresh 30s</Text>} />
                </Space>
                <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh Now</Button>
            </div>

            {/* Exception Panel */}
            {delayedShipments.length > 0 && (
                <Card
                    title={<Space><ClockCircleOutlined style={{ color: '#ff4d4f' }} /> <Text type="danger" strong>Delayed Shipments ({delayedShipments.length})</Text></Space>}
                    style={{ marginBottom: 24, border: '1px solid #ffccc7', background: '#fff1f0' }}
                    bodyStyle={{ padding: 12 }}
                >
                    <Table
                        dataSource={delayedShipments}
                        columns={shipmentColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: 800 }}
                    />
                </Card>
            )}

            <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
                <Tabs defaultActiveKey="1">
                    <Tabs.TabPane tab="Dashboard" key="1">
                        {/* Status summary */}
                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col xs={12} sm={6}>
                                <Card bordered={false} style={{ background: '#f0f5ff' }}>
                                    <Statistic title="Active Shipments" value={activeShipments.length} prefix={<SendOutlined />} />
                                </Card>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Card bordered={false} style={{ background: '#f6ffed' }}>
                                    <Statistic title="Vehicles Available" value={vehicleStatus.available || 0} prefix={<CarOutlined />} />
                                </Card>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Card bordered={false} style={{ background: '#e6f7ff' }}>
                                    <Statistic title="Vehicles On Trip" value={vehicleStatus.on_trip || 0} prefix={<CarOutlined />} />
                                </Card>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Card bordered={false} style={{ background: '#fff7e6' }}>
                                    <Statistic title="Active Zones" value={zoneActivity.length} prefix={<EnvironmentOutlined />} />
                                </Card>
                            </Col>
                        </Row>

                        {/* Active shipments table */}
                        <Card title="Active Shipments" bordered={false} style={{ marginBottom: 24 }}>
                            <Table
                                columns={shipmentColumns}
                                dataSource={activeShipments}
                                rowKey="id"
                                pagination={false}
                                size="middle"
                                scroll={{ x: 800 }}
                                locale={{ emptyText: 'No active shipments' }}
                            />
                        </Card>

                        {/* Zone Activity */}
                        <Card title="Zone Activity" bordered={false}>
                            <Row gutter={[16, 16]}>
                                {zoneActivity.length > 0 ? zoneActivity.map(z => (
                                    <Col xs={24} sm={12} md={8} key={z.zone_id}>
                                        <Card
                                            size="small"
                                            bordered
                                            style={{ borderLeft: `4px solid ${z.color || '#1890ff'}` }}
                                        >
                                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                                <Text strong>{z.zone_name}</Text>
                                                <div>
                                                    <Tag color="blue">{z.vehicle_count || 0} vehicles</Tag>
                                                    <Tag color="orange">{z.active_shipments || 0} active shipments</Tag>
                                                </div>
                                            </Space>
                                        </Card>
                                    </Col>
                                )) : (
                                    <Col span={24}>
                                        <Text type="secondary">No zone activity data.</Text>
                                    </Col>
                                )}
                            </Row>
                        </Card>
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Audit Logs" key="2">
                        <Table
                            columns={auditColumns}
                            dataSource={auditLogs}
                            rowKey="id"
                            pagination={false}
                            size="small"
                        />
                    </Tabs.TabPane>
                </Tabs>
            </div>
        </div>
    );
}
