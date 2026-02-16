import { useState, useEffect } from 'react';
import { Card, Table, Button, Typography, Tag, Space, Modal, Form, Input, InputNumber, message, Checkbox } from 'antd';
import { PlusOutlined, EnvironmentOutlined, EditOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const { Title } = Typography;

export default function SavedLocations() {
    const { token, user } = useAuth();
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const headers = { Authorization: `Bearer ${token}` };

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/addresses`, { headers });
            setLocations(res.data);
        } catch (error) {
            message.error('Failed to load locations');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLocations();
    }, []);

    const handleAddEdit = async (values) => {
        try {
            if (editingId) {
                // Editing not fully supported by backend yet (only create/delete), 
                // but if we added PUT it would go here. For now, we'll just re-create or show error.
                // Assuming we might add PUT later, but current task only asked for Create/List/Delete logic in snippets.
                // Let's implement CREATE for now as user asked to "add locations".
                message.info('Editing is not supported yet, please delete and re-create.');
            } else {
                await axios.post(`${API}/addresses`, values, { headers });
                message.success('Location added successfully');
            }
            setIsModalOpen(false);
            form.resetFields();
            setEditingId(null);
            fetchLocations();
        } catch (error) {
            message.error('Operation failed');
        }
    };

    const openEdit = (record) => {
        setEditingId(record.id);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        Modal.confirm({
            title: 'Are you sure?',
            content: 'This location will be removed.',
            onOk: async () => {
                try {
                    await axios.delete(`${API}/addresses/${id}`, { headers });
                    message.success('Location deleted');
                    fetchLocations();
                } catch (error) {
                    message.error('Failed to delete location');
                }
            }
        });
    };

    const columns = [
        { 
            title: 'Label', key: 'label', 
            render: (_, r) => (
                <Space>
                    <span style={{ fontWeight: 500 }}>{r.label}</span>
                    {r.is_global && <Tag color="gold" icon={<GlobalOutlined />}>Global</Tag>}
                </Space>
            ) 
        },
        { title: 'Address', dataIndex: 'address', key: 'address' },
        {
            title: 'Coordinates', key: 'coords',
            render: (_, r) => r.lat && r.lng ? (
                <Tag icon={<EnvironmentOutlined />}>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</Tag>
            ) : <span style={{ color: '#ccc' }}>N/A</span>
        },
        {
            title: 'Actions', key: 'actions',
            render: (_, r) => {
                // Allow delete if owner OR admin
                // (Models enforcement: admins can delete global, users can delete own)
                // We'll trust backend to reject if not allowed, but UI can hide if needed.
                // For now, show buttons for all, backend handles auth.
                return (
                    <Space>
                        {/* <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} disabled={r.is_global && user.role !== 'SUPER_ADMIN'} /> */}
                        <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(r.id)} 
                            disabled={r.is_global && user.role !== 'SUPER_ADMIN'} />
                    </Space>
                );
            }
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Saved Company Locations</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setIsModalOpen(true); }}>
                    Add Location
                </Button>
            </div>

            <Card bordered={false}>
                <Table
                    columns={columns}
                    dataSource={locations}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                />
            </Card>

            <Modal
                title={editingId ? "Edit Location" : "Add New Location"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleAddEdit}>
                    <Form.Item name="label" label="Label (e.g. Warehouse A)" rules={[{ required: true }]}>
                        <Input placeholder="Friendly name for this location" />
                    </Form.Item>
                    <Form.Item name="address" label="Full Address" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} placeholder="Complete address" />
                    </Form.Item>
                    <Space style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item name="lat" label="Latitude" rules={[{ required: true }]}>
                            <InputNumber style={{ width: 140 }} precision={6} />
                        </Form.Item>
                        <Form.Item name="lng" label="Longitude" rules={[{ required: true }]}>
                            <InputNumber style={{ width: 140 }} precision={6} />
                        </Form.Item>
                    </Space>
                    <Space style={{ display: 'flex' }} align="baseline">
                        <Form.Item name="contact" label="Contact Person">
                            <Input style={{ width: 140 }} />
                        </Form.Item>
                        <Form.Item name="phone" label="Phone Number">
                            <Input style={{ width: 140 }} />
                        </Form.Item>
                    </Space>
                    
                    {user?.role === 'SUPER_ADMIN' && (
                        <Form.Item name="is_global" valuePropName="checked">
                            <Checkbox>Share with everyone (Global)</Checkbox>
                        </Form.Item>
                    )}

                    <div style={{ textAlign: 'right', marginTop: 16 }}>
                        <Button onClick={() => setIsModalOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
                        <Button type="primary" htmlType="submit">Save Location</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
