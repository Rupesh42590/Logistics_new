import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Typography, Tag, Progress, Spin, message, Button, Descriptions, Divider } from 'antd';
import {
    ArrowLeftOutlined, EnvironmentOutlined, CarOutlined, UserOutlined,
    ClockCircleOutlined, AimOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Fix default Leaflet marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const pickupIcon = new L.DivIcon({
    html: `<div style="background:#52c41a;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

const dropIcon = new L.DivIcon({
    html: `<div style="background:#ff4d4f;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

const vehicleIcon = new L.DivIcon({
    html: `<div style="background:#262626;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.4);animation:pulse 2s infinite;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff4d4f"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
    </div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

// Demo coordinates (Hyderabad area)
const DEMO_PICKUP = { lat: 17.385044, lng: 78.486671 };
const DEMO_DROP = { lat: 17.440081, lng: 78.348915 };

// Helper: calculate distance between two lat/lng points (Haversine)
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Helper: interpolate points along a straight line for route
function interpolateRoute(start, end, numPoints = 50) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        points.push({
            lat: start.lat + t * (end.lat - start.lat),
            lng: start.lng + t * (end.lng - start.lng),
        });
    }
    return points;
}

// Status to progress mapping
const STATUS_PROGRESS = {
    PENDING: 0, ASSIGNED: 10, PICKED_UP: 30, IN_TRANSIT: 60, DELIVERED: 95, CONFIRMED: 100, CANCELLED: 0,
};

// Fit map bounds to markers
function FitBounds({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
    }, [bounds, map]);
    return null;
}

export default function RouteTracking() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [shipment, setShipment] = useState(null);
    const [vehicle, setVehicle] = useState(null);
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [vehiclePos, setVehiclePos] = useState(null);
    const animRef = useRef(null);

    const headers = { Authorization: `Bearer ${token}` };
    const basePath = user?.role === 'MSME' ? '/msme' : user?.role === 'DRIVER' ? '/driver' : user?.role === 'FLEET_MANAGER' ? '/fleet' : '/admin';

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API}/shipments/${id}`, { headers });
                setShipment(res.data);

                // Fetch vehicle details
                if (res.data.assigned_vehicle_id) {
                    try {
                        const vRes = await axios.get(`${API}/vehicles`, { headers });
                        const v = vRes.data.find(v => v.id === res.data.assigned_vehicle_id);
                        if (v) setVehicle(v);
                    } catch { }
                }
                // Fetch driver details
                if (res.data.assigned_driver_id) {
                    try {
                        const uRes = await axios.get(`${API}/users`, { headers });
                        const d = uRes.data.find(u => u.id === res.data.assigned_driver_id);
                        if (d) setDriver(d);
                    } catch { }
                }
            } catch {
                message.error('Failed to load shipment');
            }
            setLoading(false);
        };
        fetchData();
    }, [id]);

    // Coordinates
    const pickup = useMemo(() => ({
        lat: shipment?.pickup_lat || DEMO_PICKUP.lat,
        lng: shipment?.pickup_lng || DEMO_PICKUP.lng,
    }), [shipment]);

    const drop = useMemo(() => ({
        lat: shipment?.drop_lat || DEMO_DROP.lat,
        lng: shipment?.drop_lng || DEMO_DROP.lng,
    }), [shipment]);

    const routePoints = useMemo(() => interpolateRoute(pickup, drop), [pickup, drop]);
    const distance = useMemo(() => haversineDistance(pickup.lat, pickup.lng, drop.lat, drop.lng), [pickup, drop]);
    const estimatedTime = useMemo(() => Math.round((distance / 30) * 60), [distance]); // 30 km/h avg speed
    const bounds = useMemo(() => [[pickup.lat, pickup.lng], [drop.lat, drop.lng]], [pickup, drop]);

    // Animate vehicle along route
    useEffect(() => {
        if (!shipment || !routePoints.length) return;

        const progress = STATUS_PROGRESS[shipment.status] || 0;
        if (progress <= 0) {
            setVehiclePos(pickup);
            return;
        }
        if (progress >= 95) {
            setVehiclePos(drop);
            return;
        }

        // Animate from current progress point
        const startIdx = Math.floor((progress / 100) * routePoints.length);
        let currentIdx = startIdx;

        const animate = () => {
            if (currentIdx < routePoints.length) {
                setVehiclePos(routePoints[currentIdx]);
                currentIdx++;
                animRef.current = setTimeout(animate, 600);
            } else {
                currentIdx = startIdx;
                animRef.current = setTimeout(animate, 2000);
            }
        };

        animate();
        return () => clearTimeout(animRef.current);
    }, [shipment, routePoints, pickup, drop]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}><Spin size="large" /></div>;
    if (!shipment) return <div style={{ textAlign: 'center', padding: 80 }}><Text type="secondary">Shipment not found</Text></div>;

    const progress = STATUS_PROGRESS[shipment.status] || 0;
    const isLive = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(shipment.status);

    return (
        <div style={{ height: 'calc(100vh - 112px)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`${basePath}/shipments`)} />
                    <Title level={4} style={{ margin: 0 }}>Route Tracking</Title>
                    <Tag>{shipment.tracking_number}</Tag>
                    {isLive && (
                        <Tag icon={<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#52c41a', marginRight: 4, animation: 'pulse 1.5s infinite' }} />}>
                            LIVE
                        </Tag>
                    )}
                </div>
            </div>

            {/* Main Layout */}
            <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 52px)' }}>
                {/* Map Section */}
                <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e8e8', position: 'relative' }}>
                    <MapContainer
                        center={[pickup.lat, pickup.lng]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <FitBounds bounds={bounds} />

                        {/* Pickup Marker */}
                        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
                            <Popup>
                                <strong>Pickup Location</strong><br />
                                {shipment.pickup_address}
                            </Popup>
                        </Marker>

                        {/* Drop Marker */}
                        <Marker position={[drop.lat, drop.lng]} icon={dropIcon}>
                            <Popup>
                                <strong>Delivery Location</strong><br />
                                {shipment.drop_address}
                            </Popup>
                        </Marker>

                        {/* Route Line */}
                        <Polyline
                            positions={routePoints.map(p => [p.lat, p.lng])}
                            pathOptions={{ color: '#ff4d4f', weight: 4, opacity: 0.7, dashArray: '10, 6' }}
                        />
                        {/* Completed portion */}
                        {progress > 0 && (
                            <Polyline
                                positions={routePoints.slice(0, Math.floor((progress / 100) * routePoints.length)).map(p => [p.lat, p.lng])}
                                pathOptions={{ color: '#262626', weight: 5, opacity: 0.9 }}
                            />
                        )}

                        {/* Vehicle Marker */}
                        {vehiclePos && isLive && (
                            <Marker position={[vehiclePos.lat, vehiclePos.lng]} icon={vehicleIcon}>
                                <Popup>
                                    <strong>{vehicle?.name || 'Vehicle'}</strong><br />
                                    {vehicle?.plate_number || 'N/A'}<br />
                                    Driver: {driver?.name || 'N/A'}
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>

                    {/* Map Overlay - Distance & ETA */}
                    <div style={{
                        position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
                        background: 'rgba(255,255,255,0.95)', borderRadius: 10, padding: '12px 20px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', gap: 24,
                        backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Distance</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#262626' }}>{distance.toFixed(1)} km</div>
                        </div>
                        <div style={{ width: 1, background: '#e8e8e8' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Est. Time</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#262626' }}>{estimatedTime} min</div>
                        </div>
                    </div>
                </div>

                {/* Order Details Panel */}
                <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Order Info Card */}
                    <Card
                        size="small"
                        style={{ borderRadius: 12, border: '1px solid #e8e8e8' }}
                        styles={{ body: { padding: 16 } }}
                    >
                        <div style={{ marginBottom: 12 }}>
                            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Order Details</Text>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <DetailRow icon={<AimOutlined />} label="Order ID" value={shipment.tracking_number} />
                            <DetailRow icon={<UserOutlined />} label="Customer" value={shipment.pickup_contact || `Sender #${shipment.sender_id}`} />
                            <DetailRow icon={<CarOutlined />} label="Driver" value={driver?.name || 'Not assigned'} />
                            <DetailRow icon={<CarOutlined />} label="Vehicle" value={vehicle ? `${vehicle.name} (${vehicle.plate_number})` : 'Not assigned'} />
                            <DetailRow icon={<ClockCircleOutlined />} label="Status" value={
                                <Tag style={{ margin: 0 }}>{shipment.status.replace(/_/g, ' ')}</Tag>
                            } />
                            <DetailRow icon={<ClockCircleOutlined />} label="Est. Arrival" value={
                                shipment.status === 'DELIVERED' || shipment.status === 'CONFIRMED'
                                    ? 'Delivered'
                                    : `~${estimatedTime} min`
                            } />
                            <DetailRow icon={<EnvironmentOutlined />} label="Total Distance" value={`${distance.toFixed(1)} km`} />
                        </div>
                    </Card>

                    {/* Progress Card */}
                    <Card
                        size="small"
                        style={{ borderRadius: 12, border: '1px solid #e8e8e8' }}
                        styles={{ body: { padding: 16 } }}
                    >
                        <div style={{ marginBottom: 12 }}>
                            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery Progress</Text>
                        </div>
                        <Progress
                            percent={progress}
                            strokeColor={{
                                '0%': '#ff4d4f',
                                '100%': '#52c41a',
                            }}
                            size="small"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Pickup</Text>
                            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Delivered</Text>
                        </div>

                        {/* Status steps */}
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CONFIRMED'].map((s, i) => {
                                const isCompleted = STATUS_PROGRESS[shipment.status] >= STATUS_PROGRESS[s];
                                const isCurrent = shipment.status === s;
                                return (
                                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%',
                                            background: isCompleted ? '#262626' : '#f0f0f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isCurrent ? '2px solid #ff4d4f' : 'none',
                                            flexShrink: 0,
                                        }}>
                                            {isCompleted && <CheckCircleOutlined style={{ fontSize: 10, color: '#fff' }} />}
                                        </div>
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: isCurrent ? 600 : 400,
                                            color: isCompleted ? '#262626' : '#bfbfbf',
                                        }}>
                                            {s.replace(/_/g, ' ')}
                                        </Text>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Addresses Card */}
                    <Card
                        size="small"
                        style={{ borderRadius: 12, border: '1px solid #e8e8e8', flex: 1 }}
                        styles={{ body: { padding: 16 } }}
                    >
                        <div style={{ marginBottom: 12 }}>
                            <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Route Info</Text>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#52c41a' }} />
                                <div style={{ width: 1, height: 30, background: '#d9d9d9' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4d4f' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: 8 }}>
                                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>PICKUP</Text>
                                    <div style={{ fontSize: 13, color: '#262626' }}>{shipment.pickup_address}</div>
                                </div>
                                <div>
                                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>DROP</Text>
                                    <div style={{ fontSize: 13, color: '#262626' }}>{shipment.drop_address}</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Pulse animation */}
            <style>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255,77,79,0); }
                    100% { box-shadow: 0 0 0 0 rgba(255,77,79,0); }
                }
            `}</style>
        </div>
    );
}

// Reusable detail row component
function DetailRow({ icon, label, value }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#8c8c8c', fontSize: 14, width: 16, textAlign: 'center' }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</Text>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>
                    {typeof value === 'string' ? value : value}
                </div>
            </div>
        </div>
    );
}
