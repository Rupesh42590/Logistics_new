import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Select, Button, Typography, Alert, Steps, Divider, Row, Col } from 'antd';
import {
    MailOutlined, LockOutlined, UserOutlined, BankOutlined, HomeOutlined,
    EnvironmentOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined,
    AimOutlined
} from '@ant-design/icons';
import LocationPickerMap from '../components/LocationPickerMap';
import axios from 'axios';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Signup() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [form] = Form.useForm();

    const [coordInput, setCoordInput] = useState({ lat: '', lng: '' });
    const [flyTo, setFlyTo] = useState(null);
    const flyToKey = useRef(0);

    const handleGo = () => {
        const lat = parseFloat(coordInput.lat);
        const lng = parseFloat(coordInput.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            flyToKey.current += 1;
            setFlyTo([lat, lng, flyToKey.current]);
            setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        }
    };

    const [formData, setFormData] = useState({
        companyName: '',
        gstNumber: '',
        industry: '',
        adminName: '',
        email: '',
        password: '',
        confirmPassword: '',
        address: '',
        latitude: null,
        longitude: null,
    });

    const handleStep1 = async () => {
        try {
            await form.validateFields(['companyName', 'gstNumber', 'adminName', 'email', 'password', 'confirmPassword']);
            const values = form.getFieldsValue();
            if (values.password !== values.confirmPassword) {
                setError("Passwords do not match");
                return;
            }
            setFormData(prev => ({ ...prev, ...values }));
            setError(null);
            setStep(1);
        } catch {
        }
    };

    const handleSubmit = async () => {
        setError(null);
        setLoading(true);
        try {
            await axios.post(`${API}/companies`, {
                company_name: formData.companyName,
                company_description: formData.industry
                    ? `Industry: ${formData.industry}${formData.address ? ` | Address: ${formData.address}` : ''}`
                    : formData.address || null,
                admin_name: formData.adminName,
                admin_email: formData.email,
                admin_password: formData.password,
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Company name or email may already exist.');
            setStep(0);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                <div style={{ textAlign: 'center', maxWidth: 480, padding: 48 }}>
                    <CheckCircleOutlined style={{ fontSize: 72, color: '#52c41a', marginBottom: 24 }} />
                    <Title level={2}>Company Registered!</Title>
                    <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                        <strong>{formData.companyName}</strong> has been registered successfully.
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 32 }}>
                        You can now log in as Admin to manage your team — create MSME users and drivers from the Users panel.
                    </Text>
                    <Button type="primary" size="large" onClick={() => navigate('/login')}
                        style={{ background: '#facc15', borderColor: '#facc15', height: 48, paddingInline: 40, fontWeight: 600 }}>
                        Go to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <div
                className="auth-hero"
                style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #facc15 0%, #93c5fd 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 48,
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BankOutlined style={{ fontSize: 22, color: '#facc15' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>Enterprise Logistics</span>
                </div>

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
                    <h1 style={{ fontSize: 40, lineHeight: 1.2, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
                        Start shipping smarter today.
                    </h1>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                        Register your company as an admin workspace. Add your MSME users and drivers directly from inside the platform.
                    </p>
                    <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
                            <span style={{ fontSize: 14, opacity: 0.8 }}>Free to Get Started</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
                            <span style={{ fontSize: 14, opacity: 0.8 }}>No Credit Card Required</span>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 1, fontSize: 13, opacity: 0.4 }}>
                    © 2026 Enterprise Logistics Platform
                </div>
            </div>

            <div
                style={{
                    flex: 1,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '36px max(36px, 8%)',
                    maxWidth: 640,
                    overflowY: 'auto',
                }}
            >
                <div style={{ marginBottom: 16 }}>
                    <Link to="/" style={{ color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HomeOutlined /> Back to Home
                    </Link>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <Title level={2} style={{ marginBottom: 8 }}>
                        Register Your Company
                    </Title>
                    <Text type="secondary">Create your company workspace — you'll be the Admin</Text>
                </div>

                <Steps
                    current={step}
                    size="small"
                    style={{ marginBottom: 28 }}
                    items={[
                        { title: 'Company & Account', icon: <BankOutlined /> },
                        { title: 'Location', icon: <EnvironmentOutlined /> },
                    ]}
                />

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        closable
                        onClose={() => setError(null)}
                        style={{ marginBottom: 20 }}
                    />
                )}

                {step === 0 && (
                    <Form form={form} layout="vertical" size="large" initialValues={formData}>
                        <Form.Item name="companyName" label="Company Name" rules={[{ required: true, message: 'Company name is required' }]}>
                            <Input prefix={<BankOutlined style={{ color: '#bfbfbf' }} />} placeholder="Acme Logistics Ltd." />
                        </Form.Item>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item name="gstNumber" label="GST Number" rules={[{ required: true, message: 'GST is required' }]}>
                                <Input placeholder="22AAAAA0000A1Z5" />
                            </Form.Item>
                            <Form.Item name="industry" label="Industry">
                                <Select placeholder="Select Industry">
                                    <Select.Option value="manufacturing">Manufacturing</Select.Option>
                                    <Select.Option value="textiles">Textiles</Select.Option>
                                    <Select.Option value="electronics">Electronics</Select.Option>
                                    <Select.Option value="food">Food & Beverage</Select.Option>
                                    <Select.Option value="other">Other</Select.Option>
                                </Select>
                            </Form.Item>
                        </div>

                        <Form.Item name="adminName" label="Your Name (Admin)" rules={[{ required: true, message: 'Your name is required' }]}>
                            <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Full name" />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Official Email"
                            rules={[
                                { required: true, message: 'Email is required' },
                                { type: 'email', message: 'Enter a valid email' },
                            ]}
                        >
                            <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="admin@company.com" />
                        </Form.Item>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Form.Item
                                name="password"
                                label="Password"
                                rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Min 6 characters' }]}
                            >
                                <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Min 6 characters" />
                            </Form.Item>
                            <Form.Item
                                name="confirmPassword"
                                label="Confirm Password"
                                rules={[{ required: true, message: 'Please confirm password' }]}
                            >
                                <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Confirm password" />
                            </Form.Item>
                        </div>

                        <Button
                            type="primary"
                            onClick={handleStep1}
                            block
                            icon={<ArrowRightOutlined />}
                            style={{ height: 48, fontWeight: 600, fontSize: 15, marginTop: 8, background: '#facc15', borderColor: '#facc15' }}
                        >
                            Continue to Location
                        </Button>
                    </Form>
                )}

                {step === 1 && (
                    <div>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                            Pin your company's main location — click on the map, or enter coordinates below to jump directly.
                        </Text>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Latitude</Text>
                                <Input
                                    placeholder="e.g. 12.9716"
                                    value={coordInput.lat}
                                    onChange={e => setCoordInput(prev => ({ ...prev, lat: e.target.value }))}
                                    onPressEnter={handleGo}
                                    prefix={<EnvironmentOutlined style={{ color: '#bfbfbf' }} />}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Longitude</Text>
                                <Input
                                    placeholder="e.g. 77.5946"
                                    value={coordInput.lng}
                                    onChange={e => setCoordInput(prev => ({ ...prev, lng: e.target.value }))}
                                    onPressEnter={handleGo}
                                    prefix={<EnvironmentOutlined style={{ color: '#bfbfbf' }} />}
                                />
                            </div>
                            <Button
                                icon={<AimOutlined />}
                                type="primary"
                                onClick={handleGo}
                                style={{ height: 32, background: '#facc15', borderColor: '#facc15' }}
                            >
                                Go
                            </Button>
                        </div>

                        <div style={{ height: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid #d9d9d9', marginBottom: 16 }}>
                            <LocationPickerMap
                                flyTo={flyTo}
                                onLocationSelect={(loc) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        latitude: loc.lat,
                                        longitude: loc.lng,
                                        address: loc.address || prev.address
                                    }));
                                    setCoordInput({ lat: loc.lat.toFixed(6), lng: loc.lng.toFixed(6) });
                                }}
                            />
                        </div>

                        {formData.latitude && (
                            <Alert
                                type="success"
                                message={`Location pinned: ${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}`}
                                description={formData.address || 'Address detected from map'}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}

                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <Button onClick={() => setStep(0)} icon={<ArrowLeftOutlined />} style={{ height: 48, flex: 1 }}>
                                Back
                            </Button>
                            <Button type="primary" onClick={handleSubmit} loading={loading} block
                                style={{ height: 48, flex: 2, fontWeight: 600, fontSize: 15, background: '#facc15', borderColor: '#facc15' }}>
                                {loading ? 'Registering Company...' : 'Register Company'}
                            </Button>
                        </div>
                    </div>
                )}

                <Divider style={{ margin: '16px 0 12px' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>or</Text>
                </Divider>

                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ fontWeight: 600 }}>
                            Sign In
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
