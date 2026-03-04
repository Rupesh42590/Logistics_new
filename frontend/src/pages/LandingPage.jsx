import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Space, Row, Col, Card } from 'antd';
import {
    BankOutlined, SafetyOutlined, GlobalOutlined, ThunderboltOutlined,
    ArrowRightOutlined, CheckCircleOutlined, SendOutlined, CarOutlined,
    TeamOutlined, BarChartOutlined, EnvironmentOutlined, ClockCircleOutlined,
    PhoneOutlined, MailOutlined
} from '@ant-design/icons';
import './LandingPage.css';

const { Title, Text, Paragraph } = Typography;

export default function LandingPage() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: <SendOutlined style={{ fontSize: 28, color: '#facc15' }} />,
            title: 'Smart Shipments',
            desc: 'Create, track, and manage shipments with real-time status updates and automated dispatch.',
        },
        {
            icon: <CarOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
            title: 'Fleet Management',
            desc: 'Monitor vehicle utilization, maintenance schedules, and driver assignments in one dashboard.',
        },
        {
            icon: <BarChartOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
            title: 'Analytics & Reports',
            desc: 'Data-driven insights on delivery performance, fleet efficiency, and operational KPIs.',
        },
        {
            icon: <EnvironmentOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
            title: 'Zone Intelligence',
            desc: 'Geo-based zone management for optimized routing and faster last-mile delivery.',
        },
        {
            icon: <SafetyOutlined style={{ fontSize: 28, color: '#13c2c2' }} />,
            title: 'Secure & Reliable',
            desc: 'Enterprise-grade security with role-based access, audit logs, and JWT authentication.',
        },
        {
            icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#f5222d' }} />,
            title: 'Real-Time Tracking',
            desc: 'Live shipment timeline with pickup, transit, delivery, and confirmation stages.',
        },
    ];

    const steps = [
        { num: '01', title: 'Register', desc: 'Create your MSME or business account in minutes.' },
        { num: '02', title: 'Create Shipment', desc: 'Enter pickup, drop, and cargo details.' },
        { num: '03', title: 'Auto Dispatch', desc: 'Our system assigns optimal vehicles and drivers.' },
        { num: '04', title: 'Track & Deliver', desc: 'Real-time tracking until confirmed delivery.' },
    ];

    const roles = [
        { icon: <TeamOutlined style={{ fontSize: 32, color: '#facc15' }} />, title: 'Admin', desc: 'Full platform control: users, vehicles, zones, analytics, and shipment oversight.' },
        { icon: <SendOutlined style={{ fontSize: 32, color: '#52c41a' }} />, title: 'MSME / Business', desc: 'Create shipments, track deliveries, and manage your logistics operations.' },
        { icon: <CarOutlined style={{ fontSize: 32, color: '#fa8c16' }} />, title: 'Driver', desc: 'Accept assignments, update delivery status, and confirm deliveries with proof.' },
        { icon: <BarChartOutlined style={{ fontSize: 32, color: '#722ed1' }} />, title: 'Fleet Manager', desc: 'Monitor fleet health, driver performance, and operational efficiency.' },
    ];

    return (
        <div className="landing-page">
            {/* NAVBAR */}
            <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
                <div className="nav-container">
                    <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="nav-logo">
                            <BankOutlined style={{ fontSize: 20, color: '#fff' }} />
                        </div>
                        <span className="nav-title">Enterprise Logistics</span>
                    </div>

                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#roles">Who It's For</a>
                        <Button type="text" onClick={() => navigate('/login')} style={{ color: scrolled ? '#262626' : '#fff', fontWeight: 500 }}>
                            Sign In
                        </Button>
                        <Button type="primary" onClick={() => navigate('/signup')} icon={<ArrowRightOutlined />}>
                            Get Started
                        </Button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <ThunderboltOutlined /> Enterprise-Grade Logistics Platform
                    </div>
                    <h1 className="hero-title">
                        Streamline Your<br />
                        <span className="gradient-text">Logistics Operations</span>
                    </h1>
                    <p className="hero-subtitle">
                        End-to-end visibility from shipment creation to delivery confirmation.
                        Fleet management, zone intelligence, and real-time analytics — all in one platform.
                    </p>
                    <div className="hero-actions">
                        <Button type="primary" size="large" onClick={() => navigate('/signup')} icon={<ArrowRightOutlined />}
                            style={{ height: 52, padding: '0 36px', fontSize: 16, fontWeight: 600, borderRadius: 8 }}>
                            Start Free
                        </Button>
                        <Button size="large" onClick={() => navigate('/login')}
                            style={{ height: 52, padding: '0 36px', fontSize: 16, borderRadius: 8 }}>
                            Sign In
                        </Button>
                    </div>
                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-value">10K+</span>
                            <span className="stat-label">Shipments Delivered</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat-item">
                            <span className="stat-value">99.9%</span>
                            <span className="stat-label">Uptime</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat-item">
                            <span className="stat-value">500+</span>
                            <span className="stat-label">Active Partners</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="features-section" id="features">
                <div className="section-container">
                    <div className="section-header">
                        <div className="section-badge">FEATURES</div>
                        <Title level={2} style={{ marginBottom: 8 }}>Everything you need to manage logistics</Title>
                        <Text type="secondary" style={{ fontSize: 16, maxWidth: 560, display: 'block', margin: '0 auto' }}>
                            A comprehensive suite of tools designed for modern logistics operations.
                        </Text>
                    </div>

                    <Row gutter={[24, 24]} style={{ marginTop: 48 }}>
                        {features.map((f, i) => (
                            <Col xs={24} sm={12} lg={8} key={i}>
                                <Card
                                    className="feature-card"
                                    bordered={false}
                                    bodyStyle={{ padding: 28 }}
                                >
                                    <div className="feature-icon-wrap">
                                        {f.icon}
                                    </div>
                                    <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>{f.title}</Title>
                                    <Text type="secondary">{f.desc}</Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="how-section" id="how-it-works">
                <div className="section-container">
                    <div className="section-header">
                        <div className="section-badge">HOW IT WORKS</div>
                        <Title level={2} style={{ marginBottom: 8 }}>Get started in 4 simple steps</Title>
                        <Text type="secondary" style={{ fontSize: 16 }}>
                            From registration to confirmed delivery in minutes.
                        </Text>
                    </div>

                    <div className="steps-grid">
                        {steps.map((s, i) => (
                            <div key={i} className="step-card">
                                <div className="step-number">{s.num}</div>
                                <Title level={4} style={{ marginBottom: 8 }}>{s.title}</Title>
                                <Text type="secondary">{s.desc}</Text>
                                {i < steps.length - 1 && <div className="step-connector" />}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ROLES SECTION */}
            <section className="roles-section" id="roles">
                <div className="section-container">
                    <div className="section-header">
                        <div className="section-badge">WHO IT'S FOR</div>
                        <Title level={2} style={{ marginBottom: 8 }}>Built for every stakeholder</Title>
                        <Text type="secondary" style={{ fontSize: 16 }}>
                            Role-based dashboards tailored to each user's needs.
                        </Text>
                    </div>

                    <Row gutter={[24, 24]} style={{ marginTop: 48 }}>
                        {roles.map((r, i) => (
                            <Col xs={24} sm={12} lg={6} key={i}>
                                <Card className="role-card" bordered={false} bodyStyle={{ padding: 28, textAlign: 'center' }}>
                                    <div className="role-icon-wrap">
                                        {r.icon}
                                    </div>
                                    <Title level={5} style={{ marginTop: 20, marginBottom: 8 }}>{r.title}</Title>
                                    <Text type="secondary" style={{ fontSize: 13 }}>{r.desc}</Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            {/* CTA BANNER */}
            <section className="cta-section">
                <div className="cta-content">
                    <Title level={2} style={{ color: '#fff', marginBottom: 12 }}>Ready to transform your logistics?</Title>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, display: 'block', marginBottom: 32, maxWidth: 500 }}>
                        Join hundreds of businesses already shipping smarter with our platform.
                    </Text>
                    <Space size={16}>
                        <Button type="primary" size="large" ghost onClick={() => navigate('/signup')} icon={<ArrowRightOutlined />}
                            style={{ height: 48, padding: '0 32px', fontWeight: 600, borderRadius: 8 }}>
                            Create Free Account
                        </Button>
                        <Button size="large" onClick={() => navigate('/login')}
                            style={{ height: 48, padding: '0 32px', borderRadius: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}>
                            Sign In
                        </Button>
                    </Space>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-brand">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, background: '#facc15', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <BankOutlined style={{ fontSize: 16, color: '#fff' }} />
                            </div>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#262626' }}>Enterprise Logistics</span>
                        </div>
                        <Text type="secondary" style={{ fontSize: 13, maxWidth: 280, display: 'block' }}>
                            Modern logistics platform for businesses of all sizes. Ship smarter, deliver faster.
                        </Text>
                    </div>

                    <div className="footer-links">
                        <div>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Platform</Text>
                            <a href="#features">Features</a>
                            <a href="#how-it-works">How It Works</a>
                            <a href="#roles">For Teams</a>
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Account</Text>
                            <a onClick={() => navigate('/login')}>Sign In</a>
                            <a onClick={() => navigate('/signup')}>Create Account</a>
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Contact</Text>
                            <a href="mailto:support@logistics.com"><MailOutlined /> support@logistics.com</a>
                            <a href="tel:+1234567890"><PhoneOutlined /> +1 (234) 567-890</a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        © 2026 Enterprise Logistics Platform. All rights reserved.
                    </Text>
                </div>
            </footer>
        </div>
    );
}
