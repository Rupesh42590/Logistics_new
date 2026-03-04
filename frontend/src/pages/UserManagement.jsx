import { API_BASE_URL } from '../apiConfig';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
    Table, Button, Typography, Modal, Form, Input, Select, Space,
    Tag, message
} from 'antd';
import { PlusOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ROLE_COLORS = {
    ADMIN: 'purple',
    MSME: 'cyan',
    DRIVER: 'volcano',
};

export default function UserManagement() {
    const { token } = useAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/users`, { headers });
            setUsers(res.data.filter(u => u.status === 'ACTIVE'));
        } catch {
            message.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const columns = [
        {
            title: 'User',
            key: 'user',
            render: (_, r) => (
                <div>
                    <Text strong>{r.name || r.email}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
                </div>
            ),
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role) => <Tag color={ROLE_COLORS[role] || 'default'}>{role}</Tag>,
            filters: Object.keys(ROLE_COLORS).map(r => ({ text: r, value: r })),
            onFilter: (value, record) => record.role === value,
        },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', render: t => t || '-' },
        { title: 'License', dataIndex: 'license_number', key: 'license', render: t => t || '-' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>User Management</Title>
                    <Text type="secondary">Manage your company's users</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchUsers}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}
                        style={{ background: '#facc15', borderColor: '#facc15' }}>
                        Add User
                    </Button>
                </Space>
            </div>

            <Table columns={columns} dataSource={users} rowKey="id"
                loading={loading} pagination={{ pageSize: 10 }} size="middle" bordered
                style={{ background: '#fff', borderRadius: 8 }} />

            <AddUserModal
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => { setIsAddModalOpen(false); fetchUsers(); }}
                headers={headers}
            />
        </div>
    );
}

function AddUserModal({ open, onClose, onSuccess, headers }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('MSME');

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            if (values.role === 'DRIVER') {
                // Use the driver-specific endpoint
                await axios.post(`${API_BASE_URL}/admin/create-driver`, {
                    name: values.name,
                    email: values.email,
                    password: values.password,
                    phone: values.phone || null,
                    license_number: values.license_number || null,
                }, { headers });
            } else {
                // Use generic admin user creation
                await axios.post(`${API_BASE_URL}/admin/create-user`, {
                    name: values.name,
                    email: values.email,
                    password: values.password,
                    role: values.role,
                    phone: values.phone || null,
                }, { headers });
            }
            message.success(`${values.name} (${values.role}) added successfully! They can now log in.`);
            form.resetFields();
            setSelectedRole('MSME');
            onSuccess();
        } catch (err) {
            message.error('Failed: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} title={<><PlusOutlined /> Add User to Company</>}
            onCancel={() => { onClose(); form.resetFields(); setSelectedRole('MSME'); }}
            onOk={() => form.submit()} confirmLoading={loading} okText="Add User"
            okButtonProps={{ style: { background: '#facc15', borderColor: '#facc15' } }}
            destroyOnClose>
            <Form form={form} layout="vertical" onFinish={handleSubmit}
                style={{ marginTop: 16 }} initialValues={{ role: 'MSME' }}>

                <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                    <Select onChange={setSelectedRole}>
                        <Select.Option value="MSME">MSME (Business User)</Select.Option>
                        <Select.Option value="DRIVER">Driver</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
                    <Input placeholder="Full name" />
                </Form.Item>

                <Form.Item name="email" label="Email"
                    rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                    <Input placeholder="user@company.com" />
                </Form.Item>

                <Form.Item name="phone" label="Phone">
                    <Input placeholder="9876543210" />
                </Form.Item>

                {selectedRole === 'DRIVER' && (
                    <Form.Item name="license_number" label="License Number">
                        <Input placeholder="DL-KA01-2023001" />
                    </Form.Item>
                )}

                <Form.Item name="password" label="Temporary Password"
                    rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
                    <Input.Password placeholder="Min 6 characters" />
                </Form.Item>
            </Form>
        </Modal>
    );
}
