import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Card, Tag, Button, Typography, Space, message, Spin, DatePicker, Modal
} from 'antd';
import {
    CompassOutlined, UserOutlined, ClockCircleOutlined,
    CarOutlined, EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TruckCargoVisualizer from '../components/TruckCargoVisualizer';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TrackOrders() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const headers = { Authorization: `Bearer ${token}` };

    const [loading, setLoading] = useState(true);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [cargoViewVehicle, setCargoViewVehicle] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, uRes, sRes] = await Promise.all([
                axios.get(`${API}/vehicles`, { headers }),
                axios.get(`${API}/users`, { headers }),
                axios.get(`${API}/shipments`, { headers }),
            ]);
            setVehicles(vRes.data);
            setDrivers(uRes.data.filter(u => u.role === 'DRIVER'));
            setShipments(sRes.data);
        } catch {
            message.error('Failed to load tracking data');
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getAssignedDisplayShipments = (vehicleId) => {
        return shipments.filter(s =>
            s.assigned_vehicle_id === vehicleId &&
            ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(s.status)
        );
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Track Orders</Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Text>Select Date:</Text>
                    <DatePicker style={{ width: 200 }} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {vehicles.map(v => {
                    const assignedShipments = getAssignedDisplayShipments(v.id);
                    if (assignedShipments.length === 0) return null; // Only show vehicles with active assignments

                    const currentDriver = drivers.find(d => d.id === v.current_driver_id);
                    // To track the route, we just need the vehicle ID or any one active shipment's route for now.
                    // Based on existing logic it tracks by shipment ID. Using the first shipment as proxy.
                    const leadShipmentId = assignedShipments[0]?.id;

                    return (
                        <div key={v.id} style={{
                            background: '#fff',
                            borderRadius: 8,
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            {/* Vehicle Header (Theme Aesthetic) */}
                            <div style={{
                                background: '#facc15', // Theme Yellow
                                color: '#262626',
                                padding: '12px 24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <CarOutlined style={{ fontSize: 20 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 16 }}>{v.name}</div>
                                        <div style={{ fontSize: 12, opacity: 0.9 }}>{v.plate_number}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ fontSize: 13 }}>
                                        Driver: <span style={{ fontWeight: 500 }}>{currentDriver?.name || 'Unassigned'}</span>
                                    </div>
                                    <Button
                                        size="small"
                                        icon={<CompassOutlined />}
                                        onClick={() => navigate(`/admin/track/${leadShipmentId}`)}
                                        style={{ background: '#1890ff', color: 'white', border: 'none', borderRadius: 4 }}
                                    >
                                        Track
                                    </Button>
                                    <Button
                                        size="small"
                                        icon={<EyeOutlined />}
                                        onClick={() => setCargoViewVehicle(v)}
                                        style={{ borderRadius: 4 }}
                                    >
                                        Trip 1 3D
                                    </Button>
                                </div>
                            </div>

                            {/* Shipments List */}
                            <div style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: 16, background: '#fcfcfc' }}>
                                {assignedShipments.map(s => {
                                    const isCollection = s.description?.includes('Order Type: Collection');
                                    return (
                                        <Card size="small" key={s.id} style={{ width: 300, borderRadius: 6, border: '1px solid #e8e8e8' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>PO: {s.tracking_number.split('-')[2] || s.tracking_number}</Text>
                                                <Tag color={isCollection ? 'blue' : 'cyan'} style={{ margin: 0, fontSize: 10 }}>
                                                    {isCollection ? 'COLLECTION' : 'DELIVERY'}
                                                </Tag>
                                            </div>
                                            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.pickup_contact || s.pickup_address.split(',')[0]}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.description || 'Details unavailable'}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>Tracking ID:</Text>
                                                    <Text style={{ fontSize: 11, fontWeight: 500 }}>{s.tracking_number}</Text>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>Created:</Text>
                                                    <Text style={{ fontSize: 11, fontWeight: 500 }}>
                                                        {new Date(s.created_at).toLocaleDateString()}
                                                    </Text>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>Status:</Text>
                                                    <Text style={{ fontSize: 11, fontWeight: 500 }}>
                                                        {s.status.replace(/_/g, ' ')}
                                                    </Text>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {vehicles.filter(v => getAssignedDisplayShipments(v.id).length > 0).length === 0 && (
                    <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 8 }}>
                        <Text type="secondary">No active shipments are currently assigned to vehicles.</Text>
                    </div>
                )}
            </div>

            {/* 3D Cargo View Modal */}
            <Modal
                open={!!cargoViewVehicle} 
                onCancel={() => setCargoViewVehicle(null)} 
                footer={null}
                closable={false}
                width={800} 
                centered 
                bodyStyle={{ padding: 0, overflow: 'hidden', background: '#0a0a0a' }} 
                destroyOnClose>
                {cargoViewVehicle && (
                    <div style={{ height: 500, width: '100%', position: 'relative' }}>
                        <TruckCargoVisualizer
                            weightUsed={cargoViewVehicle.current_weight_used} weightCapacity={cargoViewVehicle.weight_capacity}
                            volumeUsed={cargoViewVehicle.current_volume_used} volumeCapacity={cargoViewVehicle.volume_capacity}
                            vehicleType={cargoViewVehicle.vehicle_type} vehicleName={cargoViewVehicle.name}
                            plateNumber={cargoViewVehicle.plate_number} height="100%"
                            style={{ width: '100%', height: '100%' }} showLabels={false}
                        />
                        <button
                            onClick={() => setCargoViewVehicle(null)}
                            style={{
                                position: 'absolute', top: 16, right: 60,
                                background: 'transparent',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                fontSize: 16,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                        >
                            ✕
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
