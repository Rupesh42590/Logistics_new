import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Table, Card, Tag, Button, Modal, Form, Input, Select, Typography, Space, message, ColorPicker } from 'antd';
import { PlusOutlined, EnvironmentOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = { ACTIVE: 'green', INACTIVE: 'default', MAINTENANCE: 'orange' };

export default function ZoneManagement() {
    const { token } = useAuth();
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [form] = Form.useForm();

    const headers = { Authorization: `Bearer ${token}` };

    const fetchZones = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/zones`, { headers });
            setZones(res.data);
        } catch { message.error('Failed to load zones'); }
        setLoading(false);
    };

    useEffect(() => { fetchZones(); }, []);

    const handleSave = async (values) => {
        try {
            const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1890ff';
            const payload = { ...values, color };

            if (editingZone) {
                await axios.put(`${API}/zones/${editingZone.id}`, payload, { headers });
                message.success('Zone updated');
            } else {
                await axios.post(`${API}/zones`, payload, { headers });
                message.success('Zone created');
            }
            setModalOpen(false);
            form.resetFields();
            setEditingZone(null);
            fetchZones();
        } catch (err) {
            message.error(err.response?.data?.detail || 'Failed to save zone');
        }
    };

    const handleDelete = async (id) => {
        Modal.confirm({
            title: 'Delete Zone?',
            content: 'This will remove the zone. This cannot be undone.',
            onOk: async () => {
                try {
                    await axios.delete(`${API}/zones/${id}`, { headers });
                    message.success('Zone deleted');
                    fetchZones();
                } catch (err) {
                    message.error(err.response?.data?.detail || 'Failed to delete zone');
                }
            },
        });
    };

    const openEdit = (zone) => {
        setEditingZone(zone);
        form.setFieldsValue({ ...zone });
        setModalOpen(true);
    };

    const openCreate = () => {
        setEditingZone(null);
        form.resetFields();
        setModalOpen(true);
    };

    const columns = [
        {
            title: 'Name', dataIndex: 'name', key: 'name',
            render: (t, r) => (
                <Space>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: r.color || '#1890ff' }} />
                    <Text strong>{t}</Text>
                </Space>
            ),
        },
        { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag>
        },
        { title: 'Max Capacity', dataIndex: 'max_capacity', key: 'cap', render: v => v || '∞' },
        { title: 'Vehicles', key: 'vcount', render: () => '-' },
        {
            title: '', key: 'actions', width: 100,
            render: (_, r) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                    <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(r.id)} />
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Zone Management</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Zone</Button>
            </div>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={zones}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                />
            </Card>

            <Modal
                title={editingZone ? 'Edit Zone' : 'Add Zone'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditingZone(null); form.resetFields(); }}
                footer={null}
                width={480}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="Zone Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. North Zone" />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} placeholder="Coverage area description" />
                    </Form.Item>
                    <Form.Item name="color" label="Zone Color" initialValue="#1890ff">
                        <ColorPicker />
                    </Form.Item>
                    <Form.Item name="max_capacity" label="Max Vehicle Capacity">
                        <Input type="number" placeholder="Max vehicles in zone" />
                    </Form.Item>
                    {editingZone && (
                        <Form.Item name="status" label="Status">
                            <Select options={[
                                { value: 'ACTIVE', label: 'Active' },
                                { value: 'INACTIVE', label: 'Inactive' },
                                { value: 'MAINTENANCE', label: 'Maintenance' },
                            ]} />
                        </Form.Item>
                    )}
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">
                            {editingZone ? 'Update Zone' : 'Create Zone'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
