import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Descriptions, Tag, Timeline, Typography, Button, Space, Divider, Row, Col, message, Modal, Form, Input, Spin, Table } from 'antd';
import {
    CheckCircleOutlined, ClockCircleOutlined, CarOutlined, SendOutlined,
    ExclamationCircleOutlined, StopOutlined, UserOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    PENDING: 'gold', ASSIGNED: 'blue', PICKED_UP: 'cyan',
    IN_TRANSIT: 'processing', DELIVERED: 'green', CONFIRMED: 'success', CANCELLED: 'red',
};
const STATUS_ICONS = {
    PENDING: <ClockCircleOutlined />, ASSIGNED: <UserOutlined />, PICKED_UP: <SendOutlined />,
    IN_TRANSIT: <CarOutlined />, DELIVERED: <CheckCircleOutlined />, CONFIRMED: <CheckCircleOutlined />,
    CANCELLED: <StopOutlined />,
};

export default function ShipmentDetail() {
    const { id } = useParams();
    const { token, user } = useAuth();
    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [deliverModalOpen, setDeliverModalOpen] = useState(false);
    const [deliverForm] = Form.useForm();

    const headers = { Authorization: `Bearer ${token}` };

    const fetchShipment = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/shipments/${id}`, { headers });
            setShipment(res.data);
        } catch { message.error('Failed to load shipment'); }
        setLoading(false);
    };

    useEffect(() => { fetchShipment(); }, [id]);

    const performAction = async (action, body = null) => {
        setActionLoading(true);
        try {
            if (body) {
                await axios.post(`${API}/shipments/${id}/${action}`, body, { headers });
            } else {
                await axios.post(`${API}/shipments/${id}/${action}`, {}, { headers });
            }
            message.success(`Action "${action}" completed`);
            fetchShipment();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Action failed');
        }
        setActionLoading(false);
    };

    const handleDeliver = async (values) => {
        await performAction('deliver', values);
        setDeliverModalOpen(false);
        deliverForm.resetFields();
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
    if (!shipment) return <div style={{ textAlign: 'center', padding: 80 }}><Text type="secondary">Shipment not found</Text></div>;

    const isDriver = user?.role === 'DRIVER';
    const isAdmin = ['SUPER_ADMIN', 'FLEET_MANAGER'].includes(user?.role);
    const isSender = user?.role === 'MSME';

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Space>
                    <Title level={3} style={{ margin: 0 }}>{shipment.tracking_number}</Title>
                    <Text strong style={{ fontSize: 14 }}>
                        {shipment.status.replace(/_/g, ' ')}
                    </Text>
                </Space>

                <Space>
                    {/* Driver actions */}
                    {isDriver && shipment.status === 'ASSIGNED' && (
                        <Button type="primary" onClick={() => performAction('pickup')} loading={actionLoading}>
                            Mark Picked Up
                        </Button>
                    )}
                    {isDriver && shipment.status === 'PICKED_UP' && (
                        <Button type="primary" onClick={() => performAction('in-transit')} loading={actionLoading}>
                            Mark In Transit
                        </Button>
                    )}
                    {isDriver && shipment.status === 'IN_TRANSIT' && (
                        <Button type="primary" onClick={() => setDeliverModalOpen(true)} loading={actionLoading}>
                            Mark Delivered
                        </Button>
                    )}

                    {/* Sender/Receiver confirmation */}
                    {(isSender || isAdmin) && shipment.status === 'DELIVERED' && (
                        <Button type="primary" style={{ background: '#52c41a' }} onClick={() => performAction('confirm-receipt')} loading={actionLoading}>
                            Confirm Receipt
                        </Button>
                    )}

                    {/* Admin dispatch */}
                    {isAdmin && shipment.status === 'PENDING' && (
                        <Button type="primary" onClick={() => performAction('dispatch')} loading={actionLoading}>
                            Auto Dispatch
                        </Button>
                    )}

                    {/* Receipt Link */}
                    {['DELIVERED', 'CONFIRMED'].includes(shipment.status) && (
                        <Button onClick={() => window.open(`/receipt/${shipment.id}`, '_blank')}>
                            View Receipt
                        </Button>
                    )}
                </Space>
            </div>

            <Row gutter={[24, 24]}>
                {/* 1. Timeline & Assignment (Side by Side) */}
                <Col xs={24} lg={12}>
                    <Card title="Timeline" bordered={false} style={{ height: '100%' }}>
                        <Timeline
                            items={(shipment.timeline || [])
                                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                                .map(entry => ({
                                    dot: <div style={{ width: 14, height: 14, border: '2px solid #ff4d4f', borderRadius: '50%', backgroundColor: 'transparent' }} />,
                                    children: (
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{entry.status.replace(/_/g, ' ')}</div>
                                            {entry.notes && <div><Text type="secondary">{entry.notes}</Text></div>}
                                            <div><Text type="secondary" style={{ fontSize: 11 }}>
                                                {new Date(entry.timestamp).toLocaleString()}
                                            </Text></div>
                                        </div>
                                    ),
                                }))}
                        />
                        {(!shipment.timeline || shipment.timeline.length === 0) && (
                            <Text type="secondary">No timeline entries yet.</Text>
                        )}
                    </Card>
                </Col>

                <Col xs={24} lg={12}>
                    <Card title="Assignment" bordered={false} style={{ height: '100%' }}>
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="Vehicle">
                                {shipment.assigned_vehicle ? `${shipment.assigned_vehicle.plate_number} (${shipment.assigned_vehicle.name})` : (shipment.assigned_vehicle_id ? `Vehicle #${shipment.assigned_vehicle_id}` : 'Not assigned')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Driver">
                                {shipment.assigned_driver ? shipment.assigned_driver.name : (shipment.assigned_driver_id ? `Driver #${shipment.assigned_driver_id}` : 'Not assigned')}
                            </Descriptions.Item>
                            {shipment.assigned_at && <Descriptions.Item label="Assigned">{new Date(shipment.assigned_at).toLocaleString()}</Descriptions.Item>}
                            {shipment.delivered_at && <Descriptions.Item label="Delivered">{new Date(shipment.delivered_at).toLocaleString()}</Descriptions.Item>}
                             <Descriptions.Item label="Special Instructions">{shipment.special_instructions || '-'}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                {/* 2. Shipment Details (Full Width Table) */}
                <Col span={24}>
                    <Card title="Shipment Details" bordered={false}>
                        <Table
                            dataSource={[shipment]}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            scroll={{ x: 'max-content' }}
                            columns={[
                                { title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking' },
                                { title: 'Status', dataIndex: 'status', key: 'status', render: text => text }, 
                                { title: 'Created', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleString() },
                                { title: 'Total Weight', dataIndex: 'total_weight', key: 'weight', render: v => `${v} kg` },
                                { title: 'Total Volume', dataIndex: 'total_volume', key: 'volume', render: v => `${v} m³` },
                                { title: 'Pickup Address', dataIndex: 'pickup_address', key: 'pickup' },
                                { title: 'Pickup Contact', dataIndex: 'pickup_contact', key: 'p_contact' },
                                { title: 'Pickup Phone', dataIndex: 'pickup_phone', key: 'p_phone' },
                                { title: 'Drop Address', dataIndex: 'drop_address', key: 'drop' },
                                { title: 'Drop Contact', dataIndex: 'drop_contact', key: 'd_contact' },
                                { title: 'Drop Phone', dataIndex: 'drop_phone', key: 'd_phone' },
                                { title: 'Description', dataIndex: 'description', key: 'desc' },
                            ]}
                        />
                    </Card>
                </Col>

                {/* 3. Items (Full Width) */}
                <Col span={24}>
                     {shipment.items?.length > 0 ? (
                        <Card title={`Items (${shipment.items.length})`} bordered={false}>
                            <Row gutter={[16, 16]}>
                                {shipment.items.map((item, i) => (
                                    <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                                        <Card type="inner" size="small" style={{ background: '#fafafa' }}>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                                            <div style={{ fontSize: 13, color: '#666' }}>
                                                Qty: {item.quantity} <br/>
                                                Weight: {item.weight} kg
                                            </div>
                                            {item.description && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{item.description}</div>}
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </Card>
                    ) : (
                        <Card title="Items" bordered={false}><Text type="secondary">No items found.</Text></Card>
                    )}
                </Col>
            </Row>

            {/* Deliver modal */}
            <Modal title="Confirm Delivery" open={deliverModalOpen} onCancel={() => setDeliverModalOpen(false)} footer={null}>
                <Form form={deliverForm} layout="vertical" onFinish={handleDeliver}>
                    <Form.Item name="receiver_name" label="Receiver Name" rules={[{ required: true }]}>
                        <Input placeholder="Name of the person receiving" />
                    </Form.Item>
                    <Form.Item name="receiver_phone" label="Receiver Phone">
                        <Input placeholder="Phone number" />
                    </Form.Item>
                    <Form.Item name="photo_url" label="Proof of Delivery (Photo URL)">
                        <Input placeholder="https://example.com/photo.jpg" />
                    </Form.Item>
                    <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={2} placeholder="Any notes about the delivery" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={actionLoading} block>
                        Confirm Delivery
                    </Button>
                </Form>
            </Modal>
        </div>
    );
}
