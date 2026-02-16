import { useState, useEffect } from 'react';

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
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  VENDOR: 'Vendor (Factory)', // Keeping as is but restricted
  MSME: 'Business (MSME)',
  DRIVER: 'Driver',
  FLEET_MANAGER: 'Fleet Manager',
};

const ROLE_COLORS = {
  SUPER_ADMIN: 'purple',
  VENDOR: 'blue',
  MSME: 'cyan',
  DRIVER: 'volcano',
  FLEET_MANAGER: 'geekblue',
};

const getSettingsPath = (role) => {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin/settings';
    case 'MSME': return '/msme/settings';
    case 'DRIVER': return '/driver/settings';
    case 'FLEET_MANAGER': return '/fleet/settings';
    default: return '/settings';
  }
};

const getMenuItems = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Dashboard</Link> },
        { type: 'divider' },
        { key: '/admin/shipments', icon: <SendOutlined />, label: <Link to="/admin/shipments">Shipments</Link> },
        { key: '/admin/locations', icon: <EnvironmentOutlined />, label: <Link to="/admin/locations">Saved Locations</Link> },
        { key: '/admin/vehicles', icon: <CarOutlined />, label: <Link to="/admin/vehicles">Vehicles</Link> },

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
        { key: '/msme/shipments', icon: <SendOutlined />, label: <Link to="/msme/shipments">My Shipments</Link> },
        { key: '/msme/locations', icon: <EnvironmentOutlined />, label: <Link to="/msme/locations">Saved Company Locations</Link> },
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
    case 'FLEET_MANAGER':
      return [
        { key: '/fleet', icon: <DashboardOutlined />, label: <Link to="/fleet">Dashboard</Link> },
        { key: '/fleet/shipments', icon: <SendOutlined />, label: <Link to="/fleet/shipments">Shipments</Link> },
        { key: '/fleet/vehicles', icon: <CarOutlined />, label: <Link to="/fleet/vehicles">Vehicles</Link> },

        { key: '/fleet/analytics', icon: <FundOutlined />, label: <Link to="/fleet/analytics">Analytics</Link> },
        { key: '/fleet/reports', icon: <BarChartOutlined />, label: <Link to="/fleet/reports">Reports</Link> },
        { type: 'divider' },
        { key: '/fleet/settings', icon: <SettingOutlined />, label: <Link to="/fleet/settings">Settings</Link> },
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

  useEffect(() => {
    if (token) {
      axios.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setNotifications(res.data.slice(0, 5)); // Keep top 5
          setUnreadCount(res.data.filter(n => !n.read).length);
        })
        .catch(() => { });
    }
  }, [token, location.pathname]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
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
          background: 'linear-gradient(180deg, #ff4d4f 0%, #ffccc7 100%)',
        }}
        trigger={null}
        theme="light"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
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
        {/* Header */}
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

          {/* Center Branding - "Hassy"/Glassy Style */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.8
          }}>
            
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title="Back to Home">
              <Button
                type="text"
                icon={<HomeOutlined />}
                onClick={() => {
                  const paths = {
                    SUPER_ADMIN: '/admin',
                    MSME: '/msme',
                    FLEET_MANAGER: '/fleet',
                    DRIVER: '/driver/dashboard'
                  };
                  navigate(paths[user?.role] || '/');
                }}
                style={{ color: '#595959', fontSize: 16 }}
              />
            </Tooltip>
            <Dropdown
              menu={{
                items: notifications.length > 0 ? [
                  {
                    label: <Text type="secondary" style={{ fontSize: 12 }}>Recent Notifications</Text>,
                    key: 'header',
                    disabled: true
                  },
                  { type: 'divider' },
                  ...notifications.map(n => ({
                    key: n.id,
                    label: (
                      <div style={{ padding: '8px 0', maxWidth: 250 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text strong={!n.read} style={{ fontSize: 13 }}>{n.title}</Text>
                          {!n.read && <Badge status="processing" />}
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 4 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ),
                  })),
                  { type: 'divider' },
                  {
                    label: <div style={{ textAlign: 'center', color: '#1890ff' }}>View All</div>,
                    key: 'view-all',
                    onClick: () => window.location.href = '/admin/operations' // Or dedicated notifications page
                  }
                ] : [{ label: 'No new notifications', key: 'empty', disabled: true }]
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', padding: '0 8px' }}>
                <Badge count={unreadCount} size="small" offset={[0, 0]}>
                  <BellOutlined style={{ fontSize: 18, color: '#595959' }} />
                </Badge>
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

        {/* Content */}
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
