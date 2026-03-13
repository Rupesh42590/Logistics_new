import { useState, useEffect, useCallback, useRef } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout, Menu, Avatar, Dropdown, Typography, Tag, Badge, theme, Tooltip, Button } from 'antd';
import axios from 'axios';
import {
  DashboardOutlined,
  TeamOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CarOutlined,
  EnvironmentOutlined,
  RocketOutlined,
  FundOutlined,
  SendOutlined,
  BellOutlined,
  AimOutlined,
  HomeOutlined,
  SettingOutlined,
  HistoryOutlined,
  BankOutlined,
  CompassOutlined,
  BoxPlotOutlined,
  CheckOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  MSME: 'User',
  DRIVER: 'Driver',
};

const ROLE_COLORS = {
  ADMIN: 'purple',
  MSME: 'cyan',
  DRIVER: 'volcano',
};

const getSettingsPath = (role) => {
  switch (role) {
    case 'ADMIN': return '/admin/settings';
    case 'MSME': return '/msme/settings';
    case 'DRIVER': return '/driver/settings';
    default: return '/settings';
  }
};

const getMenuItems = (role) => {
  switch (role) {
    case 'ADMIN':
      return [
        { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Dashboard</Link> },
        { key: '/admin/operations', icon: <RocketOutlined />, label: <Link to="/admin/operations">Orders</Link> },
        { key: '/admin/track-orders', icon: <AimOutlined />, label: <Link to="/admin/track-orders">Track Orders</Link> },
        { key: '/admin/operations?action=add-vehicle', icon: <CarOutlined />, label: <Link to="/admin/operations?action=add-vehicle">Add Vehicle</Link> },
        { key: '/admin/operations?action=add-location', icon: <EnvironmentOutlined />, label: <Link to="/admin/operations?action=add-location">Add Location</Link> },
        { key: '/admin/analytics', icon: <FundOutlined />, label: <Link to="/admin/analytics">Analytics</Link> },
        { type: 'divider' },
        { key: '/admin/reports', icon: <BarChartOutlined />, label: <Link to="/admin/reports">Reports</Link> },
        { key: '/admin/users', icon: <TeamOutlined />, label: <Link to="/admin/users">Users</Link> },
        { type: 'divider' },
        { key: '/admin/settings', icon: <SettingOutlined />, label: <Link to="/admin/settings">Settings</Link> },
      ];
    case 'MSME':
      return [
        { key: '/msme', icon: <DashboardOutlined />, label: <Link to="/msme">Dashboard</Link> },
        { type: 'divider' },
        { key: '/msme/settings', icon: <SettingOutlined />, label: <Link to="/msme/settings">Settings</Link> },
      ];
    case 'DRIVER':
      return [
        { key: '/driver', icon: <DashboardOutlined />, label: <Link to="/driver">Dashboard</Link> },
        { key: '/driver/history', icon: <HistoryOutlined />, label: <Link to="/driver/history">Delivery History</Link> },
        { type: 'divider' },
        { key: '/driver/settings', icon: <SettingOutlined />, label: <Link to="/driver/settings">Settings</Link> },
      ];
    default:
      return [];
  }
};

export default function AppLayout({ children }) {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { token: themeToken } = theme.useToken();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasNewNotif, setHasNewNotif] = useState(false);
  const prevUnreadRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      const newUnread = data.filter(n => !n.read).length;

      // Detect new notifications arriving
      if (newUnread > prevUnreadRef.current) {
        setHasNewNotif(true);
        setTimeout(() => setHasNewNotif(false), 3000);
      }
      prevUnreadRef.current = newUnread;

      setNotifications(data.slice(0, 5));
      setUnreadCount(newUnread);
    } catch { }
  }, [token]);

  // Initial fetch + poll every 10 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await axios.put(`${API}/notifications/${notification.id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      prevUnreadRef.current = 0;
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const menuItems = getMenuItems(user?.role);

  const userMenuItems = [
    {
      key: 'info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{user?.name || user?.email}</div>
          <Tag color={ROLE_COLORS[user?.role]} style={{ marginTop: 4 }}>
            {ROLE_LABELS[user?.role] || user?.role}
          </Tag>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate(getSettingsPath(user?.role)),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, #1677ff 0%, #93c5fd 100%)',
        }}
        trigger={null}
        theme="light"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '0' : '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <BankOutlined style={{ fontSize: 24, color: '#fff' }} />
            {!collapsed && (
              <span
                style={{
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  marginLeft: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                Enterprise Logistics
              </span>
            )}
          </div>

          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ borderRight: 0, marginTop: 8, background: 'transparent', flex: 1, overflowY: 'auto' }}
            className="custom-sidebar-menu"
          />
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {collapsed ? (
              <MenuUnfoldOutlined
                onClick={() => setCollapsed(false)}
                style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }}
              />
            ) : (
              <MenuFoldOutlined
                onClick={() => setCollapsed(true)}
                style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }}
              />
            )}
            <Text strong style={{ fontSize: 16, color: '#262626' }}>
              Enterprise Logistics Operations
            </Text>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.8 }}>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title="Back to Home">
              <Button
                type="text"
                icon={<HomeOutlined />}
                onClick={() => {
                  const paths = {
                    ADMIN: '/admin',
                    MSME: '/msme',
                    DRIVER: '/driver/dashboard'
                  };
                  navigate(paths[user?.role] || '/');
                }}
                style={{ color: '#595959', fontSize: 16 }}
              />
            </Tooltip>
            <Dropdown
              open={notifOpen}
              onOpenChange={setNotifOpen}
              menu={{
                style: { width: 320, maxHeight: 480, overflowY: 'auto' },
                items: [
                  {
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>NOTIFICATIONS</Text>
                        {unreadCount > 0 && (
                          <Button
                            type="link"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleMarkAllRead(); }}
                            style={{ fontSize: 11, padding: 0 }}
                          >
                            Mark all read
                          </Button>
                        )}
                      </div>
                    ),
                    key: 'header',
                    disabled: true,
                  },
                  { type: 'divider' },
                  ...(notifications.length > 0 ? notifications.map(n => ({
                    key: n.id,
                    onClick: () => handleNotificationClick(n),
                    style: { background: n.read ? 'transparent' : 'rgba(22, 119, 255, 0.04)' },
                    label: (
                      <div style={{ padding: '6px 0', maxWidth: 280 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <Text strong={!n.read} style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>{n.title}</Text>
                          {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1677ff', flexShrink: 0, marginTop: 4, display: 'inline-block' }} />}
                        </div>
                        <div style={{ fontSize: 12, color: '#595959', marginTop: 3, lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ),
                  })) : [{
                    key: 'empty',
                    disabled: true,
                    label: <div style={{ textAlign: 'center', padding: '16px 0', color: '#bfbfbf' }}>No notifications</div>
                  }]),
                  { type: 'divider' },
                  {
                    label: (
                      <div style={{ textAlign: 'center', color: '#1677ff', fontWeight: 500 }}>
                        View All Notifications
                      </div>
                    ),
                    key: 'view-all',
                    onClick: () => {
                      setNotifOpen(false);
                      const base = user?.role === 'ADMIN' ? '/admin' : user?.role === 'DRIVER' ? '/driver' : '/msme';
                      navigate(`${base}/notifications`);
                    }
                  }
                ]
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', padding: '0 8px', position: 'relative' }}>
                <Badge count={unreadCount} size="small">
                  <BellOutlined
                    style={{
                      fontSize: 18,
                      color: '#595959',
                      animation: hasNewNotif ? 'bellRing 0.5s ease-in-out 3' : 'none',
                    }}
                  />
                </Badge>
                {hasNewNotif && (
                  <style>{`
                    @keyframes bellRing {
                      0%,100% { transform: rotate(0deg); }
                      20% { transform: rotate(-15deg); }
                      60% { transform: rotate(15deg); }
                    }
                  `}</style>
                )}
              </div>
            </Dropdown>

            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  style={{ backgroundColor: themeToken.colorPrimary }}
                  icon={<UserOutlined />}
                  size="small"
                />
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>
                    {user?.name || user?.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                    {ROLE_LABELS[user?.role] || user?.role}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            padding: 24,
            background: '#f5f5f5',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
