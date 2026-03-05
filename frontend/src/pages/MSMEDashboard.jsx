import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Statistic, Button, Table, Tag, Modal, Form, Input, InputNumber, Typography, Space, message, Divider, Select } from 'antd';
import { DatePicker } from 'antd';
import { SendOutlined, PlusOutlined, BoxPlotOutlined, CheckCircleOutlined, ClockCircleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import LocationAutocomplete from '../components/LocationAutocomplete';
import MSMEAnalyticsGraph from '../components/MSMEAnalyticsGraph';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function MSMEDashboard() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [creating, setCreating] = useState(false);
    const [volume, setVolume] = useState(0);

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
    const [companyAddresses, setCompanyAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);

    useEffect(() => {
        if (!token) return;
        setLoadingAddresses(true);
        axios.get(`${API}/addresses`, { headers })
            .then(res => {
                setSavedAddresses(res.data.filter(a => !a.is_global));
                setCompanyAddresses(res.data.filter(a => a.company_id === user.company_id));
            })
            .catch(() => message.warning('Could not load saved locations'))
            .finally(() => setLoadingAddresses(false));
    }, [token, user]);

    const handleAddressSelect = (type, locationId) => {
        const selected = type === 'company'
            ? companyAddresses.find(a => a.id === locationId)
            : savedAddresses.find(a => a.id === locationId);

        if (!selected) return;

        if (type === 'drop' || type === 'company') {
            form.setFieldsValue({
                unloading_location: selected.address, // Update visual field too
                drop_address: selected.address,
                drop_contact: selected.contact || '',
                drop_phone: selected.phone || '',
                drop_lat: selected.lat ?? null,
                drop_lng: selected.lng ?? null,
            });
        }
    };

    const recalcVolume = () => {
        const l = form.getFieldValue('item_length') || 0;
        const b = form.getFieldValue('item_width') || 0;
        const h = form.getFieldValue('item_height') || 0;
        setVolume(l * b * h);
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

            const items = values.material_description ? [{
                name: values.material_description,
                quantity: qty,
                weight: weight,
                length, width, height
            }] : [];

            let finalPickupAddress = values.pickup_address;
            let finalPickupContact = values.pickup_contact;
            let finalPickupPhone = values.pickup_phone;

            let finalDropAddress = values.unloading_location || values.drop_address;
            let finalDropContact = values.drop_contact;
            let finalDropPhone = values.drop_phone;

            if (values.order_type === 'Collection') {
                // For Collection, the selected "Vendor" is actually the pickup
                finalPickupAddress = values.drop_address;
                finalPickupContact = values.drop_contact;
                finalPickupPhone = values.drop_phone;

                // And the drop location is the company's own location
                const defaultCompanyAddr = companyAddresses.length > 0 ? companyAddresses[0] : null;
                finalDropAddress = defaultCompanyAddr ? defaultCompanyAddr.address : 'Default Warehouse';
                finalDropContact = defaultCompanyAddr ? (defaultCompanyAddr.contact || '') : 'Dispatch';
                finalDropPhone = defaultCompanyAddr ? (defaultCompanyAddr.phone || '') : '9999999999';
            }

            await axios.post(`${API}/shipments`, {
                pickup_address: finalPickupAddress,
                pickup_contact: finalPickupContact,
                pickup_phone: finalPickupPhone,
                drop_address: finalDropAddress,
                drop_contact: finalDropContact,
                drop_phone: finalDropPhone,
                total_weight: totalWeight,
                total_volume: totalVolume,
                description: `PO: ${values.po_number || '-'} | Order Type: ${values.order_type || '-'} | Requested By: ${values.requested_by || '-'}`,
                special_instructions: values.special_instructions,
                items,
            }, { headers });
            message.success('Order created successfully!');
            setModalOpen(false);
            form.resetFields();
            setVolume(0);
            fetchShipments();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Failed to create order');
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
                title="Add Order"
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); setVolume(0); }}
                footer={null}
                width={680}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreate}
                    initialValues={{ requested_by: user?.name || '' }}
                >
                    {/* Hidden fields */}
                    <Form.Item name="pickup_address" initialValue="Default Warehouse" hidden><Input /></Form.Item>
                    <Form.Item name="pickup_contact" initialValue="Dispatch" hidden><Input /></Form.Item>
                    <Form.Item name="pickup_phone" initialValue="9999999999" hidden><Input /></Form.Item>
                    <Form.Item name="drop_address" hidden><Input /></Form.Item>
                    <Form.Item name="drop_contact" hidden><Input /></Form.Item>
                    <Form.Item name="drop_phone" hidden><Input /></Form.Item>

                    {/* Row 1: Vendor + Date */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                noStyle
                                shouldUpdate={(prevValues, currentValues) => prevValues.order_type !== currentValues.order_type}
                            >
                                {({ getFieldValue }) => {
                                    const isCollection = getFieldValue('order_type') === 'Collection';
                                    return (
                                        <Form.Item name="vendor_location" label={isCollection ? "Pickup Location" : "Vendor"} rules={[{ required: true, message: 'Please select a location' }]}>
                                            <Select
                                                placeholder={loadingAddresses ? 'Loading...' : `Select ${isCollection ? 'location' : 'vendor'}`}
                                                loading={loadingAddresses}
                                                onChange={(val) => handleAddressSelect('drop', val)}
                                                options={savedAddresses.map(a => ({ label: a.label, value: a.id }))}
                                                showSearch
                                                filterOption={(input, option) =>
                                                    option.label.toLowerCase().includes(input.toLowerCase())
                                                }
                                                notFoundContent={savedAddresses.length === 0 && !loadingAddresses ? 'No saved locations yet' : null}
                                            />
                                        </Form.Item>
                                    );
                                }}
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="order_date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Row 2: Order Type + PO Number */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="order_type" label="Order Type" rules={[{ required: true, message: 'Select order type' }]}>
                                <Select placeholder="Select type" options={[
                                    { label: 'Collection', value: 'Collection' },
                                    { label: 'Delivery', value: 'Delivery' },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="po_number" label="PO Number">
                                <Input placeholder="Enter PO number" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Row 3: Material Description + Quantity */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="material_description" label="Material Description" rules={[{ required: true, message: 'Enter material description' }]}>
                                <Input placeholder="Describe the material" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="item_qty" label="Quantity" rules={[{ required: true, message: 'Enter quantity' }]}>
                                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 10" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Row 4: Weight */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="item_weight" label="Weight (kgs)" rules={[{ required: true, message: 'Enter weight' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 50" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Volume display */}
                    <div style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 16px', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>
                        Volume: {isNaN(volume) || volume === 0 ? '0' : volume.toFixed(4)} cubic meter
                    </div>

                    {/* Row 5: Length, Breadth, Height */}
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="item_length" label="Length" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 1.2" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_width" label="Breadth" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 0.8" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_height" label="Height" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 0.5" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Row 6: Unloading Location + Requested By */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                noStyle
                                shouldUpdate={(prevValues, currentValues) => prevValues.order_type !== currentValues.order_type}
                            >
                                {({ getFieldValue }) => {
                                    const isCollection = getFieldValue('order_type') === 'Collection';
                                    if (isCollection) return null; // Completely hide Unloading Location for Collection

                                    return (
                                        <Form.Item name="unloading_location" label="Unloading Location" rules={[{ required: true, message: 'Enter unloading location' }]}>
                                            <Input placeholder="Enter unloading location" />
                                        </Form.Item>
                                    );
                                }}
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="requested_by" label="Requested By">
                                <Input placeholder="Your name" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item style={{ marginTop: 8 }}>
                        <Button type="primary" htmlType="submit" loading={creating} block size="large">
                            Submit Order
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
