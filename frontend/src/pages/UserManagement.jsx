import { API_BASE_URL } from '../apiConfig';
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Table,
    Button,
    Typography,
    Modal,
    Form,
    Input,
    Select,
    Space,
    Tag,
    message,
    Switch,
} from 'antd';
import { PlusOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { Rate } from 'antd';

const { Title, Text } = Typography;

const ROLE_COLORS = {
    SUPER_ADMIN: 'purple',
    MSME: 'cyan',
    DRIVER: 'magenta',
    FLEET_MANAGER: 'geekblue',
};

const VALID_ROLES = ['SUPER_ADMIN', 'MSME', 'DRIVER', 'FLEET_MANAGER'];

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/users`);
            // Filter out legacy/unwanted roles
            const filtered = res.data.filter(u => VALID_ROLES.includes(u.role));
            setUsers(filtered);
        } catch (err) {
            console.error(err);
            message.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        try {
            await axios.put(`${API_BASE_URL}/admin/users/${userId}/status?is_active=${!currentStatus}`);
            message.success(`User ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
            fetchUsers();
        } catch (err) {
            message.error('Failed to update status');
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const columns = [
        {
            title: 'User',
            key: 'user',
            render: (_, record) => (
                <div>
                    <Text strong>{record.name || record.email}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
                </div>
            ),
            sorter: (a, b) => (a.name || a.email).localeCompare(b.name || b.email),
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role) => <Text>{role?.replace('_', ' ')}</Text>,
            filters: Object.keys(ROLE_COLORS).map(r => ({ text: r.replace('_', ' '), value: r })),
            onFilter: (value, record) => record.role === value,
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Switch
                    checked={record.is_active}
                    onChange={() => handleToggleStatus(record.id, record.is_active)}
                    checkedChildren="Active"
                    unCheckedChildren="Inactive"
                />
            ),
            filters: [
                { text: 'Active', value: true },
                { text: 'Inactive', value: false },
            ],
            onFilter: (value, record) => record.is_active === value,
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            render: (text) => text || '-',
        },
        {
            title: 'License',
            dataIndex: 'license_number',
            key: 'license',
            render: (text) => text || '-',
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => val ? new Date(val).toLocaleDateString() : '-',
            sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>User Management</Title>
                    <Text type="secondary">Manage system users and role assignments</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchUsers}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                        Add User
                    </Button>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="middle"
                bordered
                style={{ background: '#fff', borderRadius: 8 }}
            />

            <AddUserModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchUsers();
                }}
            />
        </div>
    );
}

function AddUserModal({ open, onClose, onSuccess }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/admin/users`, values);
            message.success('User created successfully');
            form.resetFields();
            onSuccess();
        } catch (err) {
            message.error('Failed to create user: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Add New User"
            onCancel={onClose}
            onOk={() => form.submit()}
            confirmLoading={loading}
            okText="Create User"
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
                <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
                    <Input placeholder="John Doe" />
                </Form.Item>
                <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                    <Input placeholder="user@company.com" />
                </Form.Item>
                <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: 'Phone is required' }]}>
                    <Input placeholder="9876543210" />
                </Form.Item>
                <Form.Item name="password" label="Password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
                    <Input.Password placeholder="••••••••" />
                </Form.Item>
                <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Role is required' }]}>
                    <Select placeholder="Select role">
                        {VALID_ROLES.map(role => (
                            <Select.Option key={role} value={role}>{role.replace(/_/g, ' ')}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.role !== currentValues.role}
                >
                    {({ getFieldValue }) =>
                        getFieldValue('role') === 'DRIVER' ? (
                            <Form.Item name="license_number" label="License Number" rules={[{ required: true }]}>
                                <Input placeholder="DL-1234567890" />
                            </Form.Item>
                        ) : null
                    }
                </Form.Item>
                <Form.Item name="rating" label="Initial Rating" initialValue={5.0}>
                    <Input type="number" step="0.1" min={0} max={5} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
