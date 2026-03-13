import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LandingPage from './pages/LandingPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import './mobile-overrides.css';
import MSMEDashboard from './pages/MSMEDashboard';
import MyShipments from './pages/MyShipments';
import ShipmentDetail from './pages/ShipmentDetail';
import DriverDashboard from './pages/DriverDashboard';
import VehicleManagement from './pages/VehicleManagement';
import AdminOperations from './pages/AdminOperations';
import ZoneManagement from './pages/ZoneManagement';
import OperationsMonitor from './pages/OperationsMonitor';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import DriverHistory from './pages/DriverHistory';
import SavedLocations from './pages/SavedLocations';
import RouteTracking from './pages/RouteTracking';
import DeliveryReceipt from './pages/DeliveryReceipt';
import CargoVisualizer from './pages/CargoVisualizer';
import NotificationsPage from './pages/NotificationsPage';
import TrackOrders from './pages/TrackOrders';
import { AuthProvider } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#facc15',
          colorLink: '#facc15',
          borderRadius: 8,
        },
      }}
    >
      <AuthProvider>
        <ModalProvider>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/receipt/:id" element={<DeliveryReceipt />} />

              <Route path="/admin/*" element={
                <ProtectedRoute role="ADMIN">
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<AdminDashboard />} />
                      <Route path="users" element={<UserManagement />} />
                      <Route path="operations" element={<AdminOperations />} />
                      <Route path="vehicles" element={<VehicleManagement />} />
                      <Route path="zones" element={<ZoneManagement />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="reports" element={<Reports />} />
                      <Route path="track-orders" element={<TrackOrders />} />
                      <Route path="shipments" element={<AdminOperations />} />
                      <Route path="shipments/:id" element={<ShipmentDetail />} />
                      <Route path="locations" element={<AdminOperations />} />
                      <Route path="track/:id" element={<RouteTracking />} />
                      <Route path="cargo-3d" element={<CargoVisualizer />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="settings" element={<Settings />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              } />

              <Route path="/msme/*" element={
                <ProtectedRoute role="MSME">
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<MSMEDashboard />} />
                      <Route path="shipments" element={<MyShipments />} />
                      <Route path="locations" element={<SavedLocations />} />
                      <Route path="shipments/:id" element={<ShipmentDetail />} />
                      <Route path="track/:id" element={<RouteTracking />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="settings" element={<Settings />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              } />

              <Route path="/driver/*" element={
                <ProtectedRoute role="DRIVER">
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<DriverDashboard />} />
                      <Route path="shipments/:id" element={<ShipmentDetail />} />
                      <Route path="track/:id" element={<RouteTracking />} />
                      <Route path="history" element={<DriverHistory />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="settings" element={<Settings />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ModalProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
