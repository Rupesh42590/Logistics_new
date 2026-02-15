import { API_BASE_URL } from '../apiConfig';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Card, Avatar, Tag, Descriptions, Divider,
  Form, Input, Button, Typography, Space, Row, Col
} from 'antd';
import {
  UserOutlined, MailOutlined, SafetyCertificateOutlined,
  BankOutlined, AuditOutlined, EnvironmentOutlined,
  LockOutlined, LogoutOutlined, KeyOutlined, IdcardOutlined
} from '@ant-design/icons';
import './MSMEPortal.css';

const { Title, Text } = Typography;

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return <div style={{ padding: 32 }}>Loading user profile...</div>;

  const roleColor = user.role === 'SUPER_ADMIN' ? 'purple' : user.role === 'DRIVER' ? 'green' : 'blue';
  const initials = (user.email || '').substring(0, 2).toUpperCase();

  return (
    <div>
      <Row justify="center">
        <Col xs={24} md={16} lg={12}>
          <Card
            title={
              <Space>
                <LockOutlined style={{ color: '#ff4d4f' }} />
                <span>Change Password</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{
              header: {
                borderBottom: '1px solid #f1f5f9',
                fontSize: 16,
                fontWeight: 600,
              },
            }}
          >
            <ChangePasswordForm />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function ChangePasswordForm() {
  const { token } = useAuth();
  const { showAlert } = useModal();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (values) => {
    if (values.new_password !== values.confirm_password) {
      showAlert("Error", "New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/change-password`, {
        old_password: values.old_password,
        new_password: values.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert("Success", "Password changed successfully!");
      form.resetFields();
    } catch (err) {
      console.error("Change password failed", err);
      showAlert("Error", err.response?.data?.detail || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      style={{ maxWidth: 420 }}
      requiredMark={false}
    >
      <Form.Item
        label={<Text strong style={{ fontSize: 13 }}>Current Password</Text>}
        name="old_password"
        rules={[{ required: true, message: 'Please enter your current password' }]}
      >
        <Input.Password
          prefix={<KeyOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Enter current password"
          size="large"
          style={{ borderRadius: 8 }}
        />
      </Form.Item>

      <Form.Item
        label={<Text strong style={{ fontSize: 13 }}>New Password</Text>}
        name="new_password"
        rules={[
          { required: true, message: 'Please enter a new password' },
          { min: 6, message: 'Password must be at least 6 characters' }
        ]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Enter new password"
          size="large"
          style={{ borderRadius: 8 }}
        />
      </Form.Item>

      <Form.Item
        label={<Text strong style={{ fontSize: 13 }}>Confirm New Password</Text>}
        name="confirm_password"
        dependencies={['new_password']}
        rules={[
          { required: true, message: 'Please confirm your new password' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('new_password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Passwords do not match'));
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Confirm new password"
          size="large"
          style={{ borderRadius: 8 }}
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          className="msme-primary-btn"
          style={{ minWidth: 180 }}
        >
          Update Password
        </Button>
      </Form.Item>
    </Form>
  );
}
