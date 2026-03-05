import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title, subtitle, type = 'login', activeTab, onTabChange }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            <div style={{
                flex: 1,
                backgroundColor: '#1e1b4b',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '3rem',
                color: 'white',
                overflow: 'hidden'
            }} className="auth-hero">

                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(30,27,75,0.9) 0%, rgba(49,46,129,0.8) 100%), url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: 0
                }}></div>

                <div style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                        <div style={{ width: '40px', height: '40px', background: '#4f46e5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 10l7-7 7 7V21h-14z" /><path d="M5 10v11" /><path d="M19 10v11" /></svg>
                        </div>
                        <span style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '0.025em' }}>LogiSoft</span>
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px' }}>
                    <h1 style={{ fontSize: '3rem', lineHeight: '1.2', fontWeight: '700', marginBottom: '1.5rem', color: 'white' }}>
                        Scale your logistics operations with confidence.
                    </h1>
                    <p style={{ fontSize: '1.125rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                        Join over 10,000 partners managing their global supply chain with our secure, real-time dashboard.
                    </p>

                    <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                            <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>Bank-grade Security</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg>
                            <span style={{ fontWeight: '500', fontSize: '0.875rem' }}>99.9% Uptime</span>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 10, fontSize: '0.875rem', opacity: 0.6 }}>
                    © 2026 LogiSoft Inc.
                </div>
            </div>

            <div style={{
                flex: 1,
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '3rem max(3rem, 10%)',
                maxWidth: '800px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    {typeof onTabChange === 'function' ? (
                        <>
                            <button
                                onClick={() => onTabChange('login')}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: activeTab === 'login' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'login' ? '2px solid var(--primary)' : '2px solid transparent',
                                    paddingBottom: '0.25rem',
                                    fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit'
                                }}
                            >
                                Login
                            </button>
                            <button
                                onClick={() => onTabChange('signup')}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: activeTab === 'signup' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'signup' ? '2px solid var(--primary)' : '2px solid transparent',
                                    paddingBottom: '0.25rem',
                                    fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit'
                                }}
                            >
                                Sign Up
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" style={{
                                color: type === 'login' ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: type === 'login' ? '2px solid var(--primary)' : '2px solid transparent',
                                paddingBottom: '0.25rem'
                            }}>Login</Link>
                            <Link to="/signup" style={{
                                color: type === 'signup' ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: type === 'signup' ? '2px solid var(--primary)' : '2px solid transparent',
                                paddingBottom: '0.25rem'
                            }}>Sign Up</Link>
                        </>
                    )}
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--text-main)', letterSpacing: '-0.025em' }}>
                        {title}
                    </h2>
                    {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{subtitle}</p>}
                </div>

                {children}
            </div>

            <style>{`
        @media (max-width: 1024px) {
            .auth-hero {
                display: none !important;
            }
        }
      `}</style>
        </div>
    );
}
