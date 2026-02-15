import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Form, Input, Button, Typography, Alert, Divider } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined, BankOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values) => {
        setError('');
        setLoading(true);

        try {
            const role = await login(values.email, values.password);

            if (role === 'SUPER_ADMIN') navigate('/admin');
            else if (role === 'VENDOR') navigate('/vendor');
            else if (role === 'MSME') navigate('/msme');
            else if (role === 'DRIVER') navigate('/driver');
            else if (role === 'FLEET_MANAGER') navigate('/fleet');
            else setError('Unknown role');
        } catch (err) {
            console.error(err);
            setError('Invalid credentials or server error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Left Hero Panel */}
            <div
                className="auth-hero"
                style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ffccc7 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 48,
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            background: '#fff',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <BankOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>Enterprise Logistics</span>
                </div>

                {/* Tagline */}
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
                    <h1 style={{ fontSize: 40, lineHeight: 1.2, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
                        Enterprise logistics, simplified.
                    </h1>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                        End-to-end visibility from shipment creation to delivery confirmation. Fleet management, dispatch automation, and real-time analytics.
                    </p>
                    <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
                            <span style={{ fontSize: 14, opacity: 0.8 }}>Bank-grade Security</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
                            <span style={{ fontSize: 14, opacity: 0.8 }}>99.9% Uptime</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ position: 'relative', zIndex: 1, fontSize: 13, opacity: 0.4 }}>
                    © 2026 Enterprise Logistics Platform
                </div>
            </div>

            {/* Right Login Panel */}
            <div
                style={{
                    flex: 1,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '48px max(48px, 12%)',
                    maxWidth: 640,
                }}
            >
                {/* Back to Home */}
                <div style={{ marginBottom: 24 }}>
                    <Link to="/" style={{ color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HomeOutlined /> Back to Home
                    </Link>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <Title level={2} style={{ marginBottom: 8 }}>
                        Welcome back
                    </Title>
                    <Text type="secondary">Sign in to Enterprise Logistics Operations</Text>
                </div>

                {error && (
                    <Alert
                        message="Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24 }}
                        closable
                        onClose={() => setError('')}
                    />
                )}

                <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    size="large"
                    autoComplete="off"
                >
                    <Form.Item
                        name="email"
                        label="Email Address"
                        rules={[
                            { required: true, message: 'Email is required' },
                            { type: 'email', message: 'Enter a valid email' },
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="you@company.com" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[{ required: true, message: 'Password is required' }]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="••••••••" />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 8 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<LoginOutlined />}
                            block
                            style={{ height: 48, fontWeight: 600, fontSize: 15 }}
                        >
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>

                <Divider style={{ margin: '8px 0 16px' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>or</Text>
                </Divider>

                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Don't have an account?{' '}
                        <Link to="/signup" style={{ fontWeight: 600 }}>
                            Create Account
                        </Link>
                    </Text>
                </div>
            </div>

            <style>{`
                @media (max-width: 1024px) {
                    .auth-hero { display: none !important; }
                }
            `}</style>
        </div>
    );
}
