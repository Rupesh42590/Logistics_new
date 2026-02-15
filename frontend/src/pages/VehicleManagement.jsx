import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Table, Card, Tag, Button, Modal, Form, Input, InputNumber, Select, Typography, Space, Progress, message, Switch } from 'antd';
import { PlusOutlined, CarOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = { AVAILABLE: 'default', ON_TRIP: 'default', MAINTENANCE: 'default', INACTIVE: 'default' };
const TYPE_LABELS = { TRUCK: 'Truck', VAN: 'Van', PICKUP: 'Pickup', FLATBED: 'Flatbed', CONTAINER: 'Container' };

// Filter Section
const FilterSection = ({ onFilter }) => {
    const [form] = Form.useForm();
    return (
        <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
            <Form form={form} layout="inline" onFinish={onFilter}>
                <Form.Item name="status" style={{ minWidth: 150 }}>
                    <Select placeholder="Filter by Status" allowClear mode="multiple">
                        {Object.entries(STATUS_COLORS).map(([k, v]) => (
                            <Select.Option key={k} value={k}>{k.replace('_', ' ')}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="overloaded" valuePropName="checked">
                    <Input type="checkbox" style={{ display: 'none' }} />
                    {/* AntD Checkbox is better */}
                </Form.Item>
                <Form.Item name="overloaded_check" valuePropName="checked">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>Overloaded Only</span>
                        <Switch size="small" />
                    </div>
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<CarOutlined />}>Filter</Button>
                </Form.Item>
                <Form.Item>
                    <Button onClick={() => { form.resetFields(); onFilter({}); }}>Reset</Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default function VehicleManagement() {
    const { token } = useAuth();
    const [vehicles, setVehicles] = useState([]);

    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [form] = Form.useForm();

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async (filters = {}) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status && filters.status.length) filters.status.forEach(s => params.append('status', s));
            if (filters.overloaded_check) params.append('overloaded', 'true');

            const [vRes, uRes] = await Promise.all([
                axios.get(`${API}/vehicles?${params.toString()}`, { headers }),
                axios.get(`${API}/users`, { headers }),
            ]);
            setVehicles(vRes.data);
            setDrivers(uRes.data.filter(u => u.role === 'DRIVER'));
        } catch { message.error('Failed to load data'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (values) => {
        try {
            if (editingVehicle) {
                await axios.put(`${API}/vehicles/${editingVehicle.id}`, values, { headers });
                message.success('Vehicle updated');
            } else {
                await axios.post(`${API}/vehicles`, values, { headers });
                message.success('Vehicle created');
            }
            setModalOpen(false);
            form.resetFields();
            setEditingVehicle(null);
            fetchData();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Failed to save vehicle');
        }
    };

    const openEdit = (vehicle) => {
        setEditingVehicle(vehicle);
        form.setFieldsValue(vehicle);
        setModalOpen(true);
    };

    const openCreate = () => {
        setEditingVehicle(null);
        form.resetFields();
        setModalOpen(true);
    };

    const columns = [
        { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => <Space><CarOutlined /><Text strong>{t}</Text></Space> },
        { title: 'Plate #', dataIndex: 'plate_number', key: 'plate', render: t => <Tag>{t}</Tag> },
        { title: 'Type', dataIndex: 'vehicle_type', key: 'type', render: t => TYPE_LABELS[t] || t },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: s => <Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ')}</Tag>
        },
        {
            title: 'Weight Capacity', key: 'weight_cap',
            render: (_, r) => {
                const pct = r.weight_capacity > 0 ? (r.current_weight_used / r.weight_capacity) * 100 : 0;
                return (
                    <div style={{ minWidth: 120 }}>
                        <Progress percent={Math.round(pct)} size="small" strokeColor={pct > 80 ? '#ff4d4f' : '#1890ff'} />
                        <Text type="secondary" style={{ fontSize: 11 }}>{r.current_weight_used}/{r.weight_capacity} kg</Text>
                    </div>
                );
            },
        },
        {
            title: 'Volume', key: 'vol_cap',
            render: (_, r) => {
                const pct = r.volume_capacity > 0 ? (r.current_volume_used / r.volume_capacity) * 100 : 0;
                return (
                    <div style={{ minWidth: 120 }}>
                        <Progress percent={Math.round(pct)} size="small" strokeColor={pct > 80 ? '#ff4d4f' : '#52c41a'} />
                        <Text type="secondary" style={{ fontSize: 11 }}>{r.current_volume_used}/{r.volume_capacity} m³</Text>
                    </div>
                );
            },
        },

        {
            title: 'Driver', dataIndex: 'current_driver_id', key: 'driver',
            render: did => drivers.find(d => d.id === did)?.name || '-'
        },
        {
            title: '', key: 'actions', width: 60,
            render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />,
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Vehicle Management</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Vehicle</Button>
            </div>

            <FilterSection onFilter={fetchData} />

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={vehicles}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                    scroll={{ x: 1100 }}
                />
            </Card>

            <Modal
                title={editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditingVehicle(null); form.resetFields(); }}
                footer={null}
                width={540}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="Vehicle Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. Truck-01" />
                    </Form.Item>
                    <Form.Item name="plate_number" label="Plate Number" rules={[{ required: true }]}>
                        <Input placeholder="e.g. KA-01-AB-1234" />
                    </Form.Item>
                    <Form.Item name="vehicle_type" label="Type" initialValue="TRUCK">
                        <Select options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size="middle">
                        <Form.Item name="weight_capacity" label="Weight Capacity (kg)" initialValue={1000}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="volume_capacity" label="Volume Capacity (m³)" initialValue={10}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="current_driver_id" label="Assigned Driver">
                        <Select allowClear placeholder="Select driver" options={
                            drivers.map(d => {
                                // Check if driver is assigned to ANY vehicle
                                const assignedVehicle = vehicles.find(v => v.current_driver_id === d.id);
                                // Enable if:
                                // 1. Driver is not assigned to any vehicle
                                // 2. Driver is assigned to THIS vehicle (editing mode)
                                const isAssignedToOther = assignedVehicle && assignedVehicle.id !== editingVehicle?.id;
                                
                                return {
                                    value: d.id,
                                    label: `${d.name} (${d.email}) ${isAssignedToOther ? `[Assigned to ${assignedVehicle.plate_number}]` : ''}`,
                                    disabled: isAssignedToOther
                                };
                            })
                        } />
                    </Form.Item>
                    {editingVehicle && (
                        <Form.Item name="status" label="Status">
                            <Select options={Object.entries(STATUS_COLORS).map(([k]) => ({ value: k, label: k.replace('_', ' ') }))} />
                        </Form.Item>
                    )}
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">
                            {editingVehicle ? 'Update Vehicle' : 'Create Vehicle'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
