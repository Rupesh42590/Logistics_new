import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Statistic, Button, Table, Tag, Modal, Form, Input, InputNumber, Typography, Space, message, Divider, Select } from 'antd';
import { SendOutlined, PlusOutlined, BoxPlotOutlined, CheckCircleOutlined, ClockCircleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import LocationAutocomplete from '../components/LocationAutocomplete';
import MSMEAnalyticsGraph from '../components/MSMEAnalyticsGraph';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function MSMEDashboard() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [creating, setCreating] = useState(false);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchShipments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/shipments`, { headers });
            setShipments(res.data);
        } catch { message.error('Failed to load shipments'); }
        setLoading(false);
    };

    useEffect(() => { fetchShipments(); }, []);

    const stats = {
        total: shipments.length,
        pending: shipments.filter(s => s.status === 'PENDING').length,
        active: shipments.filter(s => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(s.status)).length,
        delivered: shipments.filter(s => ['DELIVERED', 'CONFIRMED'].includes(s.status)).length,
    };

    const [savedAddresses, setSavedAddresses] = useState([]);

    useEffect(() => {
        if (token) {
            // Fetch saved addresses (Mocking for now as endpoint might not exist yet or is part of user profile)
            // In a real scenario: axios.get(`${API}/users/addresses`, { headers }).then(...)
            setSavedAddresses([
                { id: 1, label: 'Warehouse A - 123 Logistics Way', address: '123 Logistics Way, Ind. Park', lat: 12.9716, lng: 77.5946 },
                { id: 2, label: 'Factory B - 456 Manuf. Rd', address: '456 Manuf. Rd, Ind. Zone', lat: 13.0827, lng: 80.2707 },
                { id: 3, label: 'Office HQ - 789 Corp Blvd', address: '789 Corp Blvd, City Center', lat: 28.7041, lng: 77.1025 },
            ]);
        }
    }, [token]);

    const handleAddressSelect = (type, value) => {
        const selected = savedAddresses.find(a => a.id === value);
        if (!selected) return;

        if (type === 'pickup') {
            form.setFieldsValue({
                pickup_address: selected.address,
                // pickup_lat: selected.lat,
                // pickup_lng: selected.lng
            });
        } else {
            form.setFieldsValue({
                drop_address: selected.address, // Keep hidden or for reference
                drop_lat: selected.lat,
                drop_lng: selected.lng
            });
        }
    };

    const handleCreate = async (values) => {
        setCreating(true);
        try {
            const qty = values.item_qty || 1;
            const weight = values.item_weight || 0;
            const length = values.item_length || 0;
            const width = values.item_width || 0;
            const height = values.item_height || 0;

            const itemVolume = length * width * height;
            const totalVolume = itemVolume * qty;
            const totalWeight = weight * qty;

            const items = values.item_name ? [{
                name: values.item_name,
                quantity: qty,
                weight: weight,
                length, width, height
            }] : [];

            await axios.post(`${API}/shipments`, {
                pickup_address: values.pickup_address,
                pickup_contact: values.pickup_contact,
                pickup_phone: values.pickup_phone,
                drop_address: values.drop_address,
                drop_contact: values.drop_contact,
                drop_phone: values.drop_phone,
                total_weight: totalWeight,
                total_volume: totalVolume,
                description: values.description,
                special_instructions: values.special_instructions,
                items,
            }, { headers });
            message.success('Shipment created!');
            setModalOpen(false);
            form.resetFields();
            fetchShipments();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Failed to create shipment');
        }
        setCreating(false);
    };

    const statusColor = {
        PENDING: 'gold', ASSIGNED: 'blue', PICKED_UP: 'cyan',
        IN_TRANSIT: 'processing', DELIVERED: 'green', CONFIRMED: 'success', CANCELLED: 'red',
    };

    const columns = [
        {
            title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking_number',
            render: (t, r) => <a onClick={() => navigate(r.id.toString())}>{t}</a>
        },
        {
            title: 'Item', dataIndex: 'items', key: 'items',
            render: (items) => (
                <Space direction="vertical" size={0}>
                    {items?.length > 0 ? items.map(i => (
                        <Text key={i.id} style={{ fontSize: 13 }}>{i.name}</Text>
                    )) : <Text type="secondary">-</Text>}
                </Space>
            )
        },
        { title: 'Pickup', dataIndex: 'pickup_address', key: 'pickup', ellipsis: true },
        { title: 'Drop', dataIndex: 'drop_address', key: 'drop', ellipsis: true },
        { title: 'Weight', dataIndex: 'total_weight', key: 'weight', render: v => `${v} kg` },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: s => <span style={{ fontWeight: 500 }}>{s.replace(/_/g, ' ')}</span>
        },
        {
            title: 'Created', dataIndex: 'created_at', key: 'created_at',
            render: d => new Date(d).toLocaleDateString()
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>MSME Dashboard</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                    New Shipment
                </Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card bordered={false}><Statistic title="Total Shipments" value={stats.total} prefix={<ShoppingOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}><Statistic title="Pending" value={stats.pending} prefix={<ClockCircleOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}><Statistic title="Active" value={stats.active} prefix={<SendOutlined />} /></Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false}><Statistic title="Delivered" value={stats.delivered} prefix={<CheckCircleOutlined />} /></Card>
                </Col>
            </Row>

            <MSMEAnalyticsGraph data={shipments} />

            <Card title="Recent Shipments" bordered={false}>
                <Table
                    columns={columns}
                    dataSource={shipments.slice(0, 3)}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                />
            </Card>

            <Modal
                title="Create New Shipment"
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={null}
                width={640}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate}>
                    {/* Pickup Details Removed as per request. Auto-filling default. */}
                    <Form.Item name="pickup_address" initialValue="Default Warehouse - 123 Main St" hidden><Input /></Form.Item>
                    <Form.Item name="pickup_contact" initialValue="Dispatch Manager" hidden><Input /></Form.Item>
                    <Form.Item name="pickup_phone" initialValue="9999999999" hidden><Input /></Form.Item>

                    <Divider orientation="left" plain>Drop Details</Divider>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item label="Saved Drop Location">
                                <Select
                                    placeholder="Select a saved location"
                                    onChange={(val) => handleAddressSelect('drop', val)}
                                    options={savedAddresses.map(a => ({ label: a.label, value: a.id }))}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="drop_lat" label="Drop Latitude" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} precision={6} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="drop_lng" label="Drop Longitude" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} precision={6} />
                            </Form.Item>
                        </Col>
                        {/* Hidden drop address, backend usually expects a string, we might need to construct one or send lat/lng separately */}
                        <Form.Item name="drop_address" hidden><Input /></Form.Item>

                        <Col span={12}>
                            <Form.Item name="drop_contact" label="Contact Name"><Input /></Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="drop_phone" label="Phone"><Input /></Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left" plain>Cargo Details</Divider>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="item_name" label="Item Name"><Input /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_qty" label="Qty"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_weight" label="Item Weight (kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_length" label="Length (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_width" label="Width (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_height" label="Height (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
                    <Form.Item name="special_instructions" label="Special Instructions"><Input.TextArea rows={2} /></Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={creating} block size="large">
                            Create Shipment
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
