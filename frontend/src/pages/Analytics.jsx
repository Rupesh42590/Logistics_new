import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Space, message, Spin, Progress, Button } from 'antd';
import {
    CarOutlined, SendOutlined, CheckCircleOutlined, ClockCircleOutlined,
    ThunderboltOutlined, TeamOutlined, BarChartOutlined, RiseOutlined, DownloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const COLORS = ['#cf1322', '#fa541c', '#fa8c16', '#ad2102'];

export default function Analytics() {
    const { token } = useAuth();
    const [fleetAnalytics, setFleetAnalytics] = useState({});
    const [shipmentAnalytics, setShipmentAnalytics] = useState({});
    const [driverAnalytics, setDriverAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [fleet, shipments, drivers] = await Promise.all([
                    axios.get(`${API}/analytics/fleet`, { headers }),
                    axios.get(`${API}/analytics/shipments`, { headers }),
                    axios.get(`${API}/analytics/drivers`, { headers }),
                ]);
                setFleetAnalytics(fleet.data);
                setShipmentAnalytics(shipments.data);
                setDriverAnalytics(drivers.data);
            } catch { message.error('Failed to load analytics'); }
            setLoading(false);
        };
        fetchData();
    }, []);

    const handleExport = async () => {
        try {
            const response = await axios.get(`${API}/admin/reports/export`, {
                headers,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `shipments_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
        } catch {
            message.error('Failed to export CSV');
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

    const fleetData = [
        { name: 'Available', value: fleetAnalytics.available || 0 },
        { name: 'On Trip', value: fleetAnalytics.on_trip || 0 },
        { name: 'Maintenance', value: fleetAnalytics.maintenance || 0 },
    ];

    const driverColumns = [
        {
            title: 'Driver', dataIndex: 'name', key: 'name',
            render: (n, r) => <Space><TeamOutlined /><Text strong>{n || r.email}</Text></Space>
        },
        { title: 'Total', dataIndex: 'total_shipments', key: 'total' },
        {
            title: 'Completed', dataIndex: 'completed', key: 'completed',
            render: v => <Tag color="#cf1322">{v}</Tag>
        },
        {
            title: 'Active', dataIndex: 'active', key: 'active',
            render: v => <Tag color="orange">{v}</Tag>
        },
        {
            title: 'Completion Rate', key: 'rate',
            render: (_, r) => {
                const rate = r.total_shipments > 0 ? Math.round((r.completed / r.total_shipments) * 100) : 0;
                return <Progress percent={rate} size="small" strokeColor={rate > 80 ? '#cf1322' : rate > 50 ? '#fa541c' : '#ad2102'} />;
            },
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ marginBottom: 0 }}>Analytics Dashboard</Title>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                    Export Report (CSV)
                </Button>
            </div>

            {/* KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Total" value={shipmentAnalytics.total} prefix={<SendOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Pending" value={shipmentAnalytics.pending} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Active" value={shipmentAnalytics.active} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Delivered" value={shipmentAnalytics.delivered} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Confirmed" value={shipmentAnalytics.confirmed} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Utilization" value={fleetAnalytics.utilization_rate} suffix="%" prefix={<CarOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Today" value={shipmentAnalytics.today} prefix={<BarChartOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6} md={3}>
                    <Card variant="borderless"><Statistic title="Rate" value={shipmentAnalytics.completion_rate} suffix="%" prefix={<RiseOutlined />} /></Card>
                </Col>
            </Row>

            <Row gutter={[24, 24]}>
                {/* Visualizations */}
                <Col xs={24} lg={16}>
                    <Card title="Shipment Volume (Last 7 Days)" variant="borderless" style={{ marginBottom: 24 }}>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={shipmentAnalytics.chart_data || []}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#cf1322" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#cf1322" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Area type="monotone" dataKey="count" stroke="#cf1322" fillOpacity={1} fill="url(#colorCount)" name="Shipments" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="Driver Performance" variant="borderless">
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={driverAnalytics.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="completed" fill="#cf1322" name="Completed" />
                                    <Bar dataKey="active" fill="#fa541c" name="Active" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={8}>
                    <Card title="Fleet Status" variant="borderless" style={{ marginBottom: 24 }}>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={fleetData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {fleetData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#fa8c16', '#cf1322', '#fa541c'][index % 3]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <Statistic title="Total Vehicles" value={fleetAnalytics.total_vehicles} />
                        </div>
                    </Card>

                    <Card title="Top Drivers" variant="borderless">
                        <Table
                            columns={driverColumns.slice(0, 3)} // Simplified columns
                            dataSource={driverAnalytics.slice(0, 5)}
                            rowKey="driver_id"
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
