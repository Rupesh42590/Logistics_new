import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Card, Row, Col, Statistic, Button, Table, Modal, Form, Input,
    InputNumber, Typography, Space, message, Select, Tag
} from 'antd';
import { DatePicker } from 'antd';
import {
    SendOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
    ShoppingOutlined, EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import MSMEAnalyticsGraph from '../components/MSMEAnalyticsGraph';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function MSMEDashboard() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const headers = { Authorization: `Bearer ${token}` };

    // ── Shipment State ──
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [creating, setCreating] = useState(false);
    const [volume, setVolume] = useState(0);

    // ── Company data for order routing ──
    const [myCompany, setMyCompany] = useState(null);
    const [otherCompanies, setOtherCompanies] = useState([]);
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // ── Fetch Functions ──
    const fetchShipments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/shipments`, { headers });
            setShipments(res.data);
        } catch { message.error('Failed to load shipments'); }
        setLoading(false);
    };

    const fetchCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const [meRes, othersRes, addrRes] = await Promise.all([
                axios.get(`${API}/companies/me`, { headers }),
                axios.get(`${API}/companies/others`, { headers }),
                axios.get(`${API}/addresses`, { headers }),
            ]);
            setMyCompany(meRes.data);
            setOtherCompanies(othersRes.data);
            setSavedAddresses(addrRes.data);
        } catch { message.warning('Could not load company data'); }
        setLoadingCompanies(false);
    };

    useEffect(() => {
        fetchShipments();
        fetchCompanies();
    }, []);

    // ── Shipment Stats ──
    const stats = {
        total: shipments.length,
        pending: shipments.filter(s => s.status === 'PENDING').length,
        active: shipments.filter(s => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(s.status)).length,
        delivered: shipments.filter(s => ['DELIVERED', 'CONFIRMED'].includes(s.status)).length,
    };

    // We no longer need these handlers since we look up the ID at submit time.
    // They are left blank to avoid errors if referenced elsewhere, but we will remove them from the Selects.

    const recalcVolume = () => {
        const l = form.getFieldValue('item_length') || 0;
        const b = form.getFieldValue('item_width') || 0;
        const h = form.getFieldValue('item_height') || 0;
        setVolume(l * b * h);
    };

    const handleCreate = async (values) => {
        setCreating(true);
        try {
            // Look up the selected location: could be a company (prefixed "company-") or a saved address (prefixed "addr-")
            const selectedValue = values.vendor_location;
            let selectedLoc = null;

            if (typeof selectedValue === 'string' && selectedValue.startsWith('company-')) {
                const compId = parseInt(selectedValue.replace('company-', ''));
                const comp = otherCompanies.find(c => c.id === compId);
                if (comp) selectedLoc = { address: comp.address, lat: comp.lat, lng: comp.lng, name: comp.name };
            } else if (typeof selectedValue === 'string' && selectedValue.startsWith('addr-')) {
                const addrId = parseInt(selectedValue.replace('addr-', ''));
                const addr = savedAddresses.find(a => a.id === addrId);
                if (addr) selectedLoc = { address: addr.address, lat: addr.lat, lng: addr.lng, name: addr.label };
            }

            if (!selectedLoc) {
                message.error("Please select a valid location.");
                setCreating(false);
                return;
            }
            if (!myCompany || !myCompany.lat || !myCompany.lng) {
                message.error("Your company has no registered location. Please ask your admin to update it.");
                setCreating(false);
                return;
            }

            const qty = values.item_qty || 1;
            const weight = values.item_weight || 0;
            const length = values.item_length || 0;
            const width = values.item_width || 0;
            const height = values.item_height || 0;
            const itemVolume = length * width * height;
            const totalVolume = itemVolume * qty;
            const totalWeight = weight * qty;
            const items = values.material_description ? [{
                name: values.material_description, quantity: qty, weight, length, width, height
            }] : [];

            let finalPickupAddress, finalPickupContact, finalPickupPhone, finalPickupLat, finalPickupLng;
            let finalDropAddress, finalDropContact, finalDropPhone, finalDropLat, finalDropLng;

            if (values.order_type === 'Collection') {
                // Collection: driver picks up FROM selected location and drops TO user's company
                finalPickupAddress = selectedLoc.address;
                finalPickupContact = selectedLoc.name;
                finalPickupPhone = '';
                finalPickupLat = selectedLoc.lat;
                finalPickupLng = selectedLoc.lng;

                finalDropAddress = myCompany.address;
                finalDropContact = myCompany.name;
                finalDropPhone = '';
                finalDropLat = myCompany.lat;
                finalDropLng = myCompany.lng;
            } else {
                // Delivery: driver picks up FROM user's company and drops TO selected location
                finalPickupAddress = myCompany.address;
                finalPickupContact = myCompany.name;
                finalPickupPhone = '';
                finalPickupLat = myCompany.lat;
                finalPickupLng = myCompany.lng;

                finalDropAddress = selectedLoc.address;
                finalDropContact = selectedLoc.name;
                finalDropPhone = '';
                finalDropLat = selectedLoc.lat;
                finalDropLng = selectedLoc.lng;
            }

            await axios.post(`${API}/shipments`, {
                pickup_address: finalPickupAddress, pickup_contact: finalPickupContact, pickup_phone: finalPickupPhone,
                pickup_lat: finalPickupLat, pickup_lng: finalPickupLng,
                drop_address: finalDropAddress, drop_contact: finalDropContact, drop_phone: finalDropPhone,
                drop_lat: finalDropLat, drop_lng: finalDropLng,
                total_weight: totalWeight, total_volume: totalVolume,
                description: `PO: ${values.po_number || '-'} | Order Type: ${values.order_type || '-'} | Requested By: ${values.requested_by || '-'}`,
                special_instructions: values.special_instructions, items,
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

    // ── Columns ──
    const shipmentColumns = [
        {
            title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking_number',
            render: (t, r) => <a onClick={() => navigate(`/msme/shipments/${r.id}`)}>{t}</a>
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
        {
            title: 'Type', key: 'order_type', width: 100,
            render: (_, r) => {
                if (r.description && r.description.includes('Order Type: Collection')) {
                    return <Tag color="orange">Collection</Tag>;
                }
                if (r.description && r.description.includes('Order Type: Delivery')) {
                    return <Tag color="blue">Delivery</Tag>;
                }
                return null;
            }
        },
        { 
            title: 'Pickup', 
            key: 'pickup', 
            render: (_, r) => r.pickup_lat && r.pickup_lng ? `${r.pickup_lat.toFixed(4)}, ${r.pickup_lng.toFixed(4)}` : r.pickup_address,
            ellipsis: true 
        },
        { 
            title: 'Drop', 
            key: 'drop', 
            render: (_, r) => r.drop_lat && r.drop_lng ? `${r.drop_lat.toFixed(4)}, ${r.drop_lng.toFixed(4)}` : r.drop_address,
            ellipsis: true 
        },
        { title: 'Weight', dataIndex: 'total_weight', key: 'weight', render: v => `${v} kg`, width: 90 },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 120,
            render: s => <span style={{ fontWeight: 500 }}>{s.replace(/_/g, ' ')}</span>
        },
        {
            title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 110,
            render: d => new Date(d).toLocaleDateString()
        },
        {
            title: '', key: 'actions', width: 50,
            render: (_, r) => (
                <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/msme/shipments/${r.id}`)} />
            )
        },
    ];

    const handleOrderTypeChange = (type) => {
        form.resetFields(['vendor_location']);
    };

    return (
        <div>
            {/* ─── Header ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>User Dashboard</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                    New Shipment
                </Button>
            </div>

            {/* ─── Stats ─── */}
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

            {/* ─── Analytics ─── */}
            <MSMEAnalyticsGraph data={shipments} />

            {/* ─── All Shipments ─── */}
            <Card title="All Shipments" bordered={false}>
                <Table
                    columns={shipmentColumns}
                    dataSource={shipments}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    scroll={{ x: 800 }}
                />
            </Card>

            {/* ─── New Shipment Modal ─── */}
            <Modal
                title="Add Order"
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); setVolume(0); }}
                footer={null}
                width={680}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate}
                    initialValues={{ requested_by: user?.name || '' }}>

                    {/* Row 1: Location + Date */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.order_type !== cur.order_type}>
                                {({ getFieldValue }) => {
                                    const isCollection = getFieldValue('order_type') === 'Collection';
                                    return (
                                        <Form.Item name="vendor_location" label={isCollection ? "Pickup Location" : "Drop-off Location"}
                                            rules={[{ required: true, message: 'Please select a location' }]}>
                                            <Select
                                                placeholder={loadingCompanies ? 'Loading...' : 'Select location'}
                                                loading={loadingCompanies}
                                                showSearch
                                                filterOption={(input, option) => (option.label || '').toLowerCase().includes(input.toLowerCase())}
                                                notFoundContent={otherCompanies.length === 0 && savedAddresses.length === 0 && !loadingCompanies ? 'No locations available' : null}
                                                options={[
                                                    ...(otherCompanies.length > 0 ? [{
                                                        label: 'Companies',
                                                        options: otherCompanies.map(c => ({ label: c.name, value: `company-${c.id}` }))
                                                    }] : []),
                                                    ...(savedAddresses.length > 0 ? [{
                                                        label: 'Saved Locations',
                                                        options: savedAddresses.map(a => ({ label: a.label, value: `addr-${a.id}` }))
                                                    }] : []),
                                                ]}
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
                                ]} onChange={handleOrderTypeChange} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="po_number" label="PO Number">
                                <Input placeholder="Enter PO number" />
                            </Form.Item>
                        </Col>
                    </Row>



                    {/* Row 3: Material + Quantity */}
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

                    {/* Row 4: Weight + Requested By */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="item_weight" label="Weight (kgs)" rules={[{ required: true, message: 'Enter weight' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 50" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="requested_by" label="Requested By">
                                <Input placeholder="Your name" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Volume display */}
                    <div style={{ background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 16px', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>
                        Volume: {isNaN(volume) || volume === 0 ? '0' : volume.toFixed(4)} cubic meter
                    </div>

                    {/* Row 5: Dimensions */}
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="item_length" label="Length (m)" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 1.2" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_width" label="Breadth (m)" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 0.8" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="item_height" label="Height (m)" rules={[{ required: true, message: 'Required' }]}>
                                <InputNumber min={0} style={{ width: '100%' }} onChange={recalcVolume} placeholder="e.g. 0.5" />
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
