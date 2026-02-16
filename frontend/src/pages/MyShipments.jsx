import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Table, Tag, Typography, Button, message, Card, Modal, Select } from 'antd';
import { EyeOutlined, CompassOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import AdvancedFilterBar from '../components/AdvancedFilterBar';

const { Title } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    PENDING: 'default', ASSIGNED: 'default', PICKED_UP: 'default',
    IN_TRANSIT: 'default', DELIVERED: 'default', CONFIRMED: 'default', CANCELLED: 'default',
};

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'PICKED_UP', label: 'Picked Up' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

export default function MyShipments() {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Initialize filters from URL params
    const [filters, setFilters] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        return status ? { status: [status] } : {};
    });
    
    // Bulk Assignment State
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [assigning, setAssigning] = useState(false);

    const headers = { Authorization: `Bearer ${token}` };
    const basePath = user?.role === 'MSME' ? '/msme' : user?.role === 'DRIVER' ? '/driver' : user?.role === 'FLEET_MANAGER' ? '/fleet' : '/admin';

    const fetchShipments = useCallback(async (currentFilters = {}) => {
        setLoading(true);
        try {
            // Build query params
            const params = new URLSearchParams();
            if (currentFilters.q) params.append('q', currentFilters.q);
            if (currentFilters.status && currentFilters.status.length > 0) {
                currentFilters.status.forEach(s => params.append('status', s));
            }
            if (currentFilters.date_from) params.append('date_from', currentFilters.date_from);
            if (currentFilters.date_to) params.append('date_to', currentFilters.date_to);

            // New filters
            if (currentFilters.driver_id) params.append('driver_id', currentFilters.driver_id);
            if (currentFilters.vehicle_id) params.append('vehicle_id', currentFilters.vehicle_id);
            if (currentFilters.delayed) params.append('delayed', 'true');

            const res = await axios.get(`${API}/shipments?${params.toString()}`, { headers });
            setShipments(res.data);
        } catch (err) {
            console.error(err);
            message.error('Failed to load shipments');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchVehicles = useCallback(async () => {
        if (['SUPER_ADMIN', 'FLEET_MANAGER'].includes(user?.role)) {
            try {
                const res = await axios.get(`${API}/vehicles`, { headers });
                setVehicles(res.data);
            } catch (err) {
                console.error("Failed to load vehicles");
            }
        }
    }, [user, token]);

    useEffect(() => {
        fetchShipments(filters);
        fetchVehicles();
    }, [fetchShipments, fetchVehicles]); 

    const onSelectChange = (newSelectedRowKeys) => {
        setSelectedRowKeys(newSelectedRowKeys);
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: onSelectChange,
        getCheckboxProps: (record) => ({
            disabled: !['PENDING', 'ASSIGNED'].includes(record.status), // Allow pending and assigned
        }),
    };

    const handleBulkAssign = async () => {
        if (!selectedVehicle) {
            message.error("Please select a vehicle");
            return;
        }

        const vehicle = vehicles.find(v => v.id === selectedVehicle);
        if (!vehicle) return;

        if (!vehicle.current_driver_id) {
            message.error("Selected vehicle does not have an assigned driver. Please assign a driver to the vehicle first.");
            return;
        }

        setAssigning(true);
        let successCount = 0;
        let failCount = 0;

        try {
            await Promise.all(selectedRowKeys.map(async (shipmentId) => {
                try {
                    await axios.post(`${API}/shipments/${shipmentId}/assign`, {
                        vehicle_id: vehicle.id,
                        driver_id: vehicle.current_driver_id
                    }, { headers });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to assign shipment ${shipmentId}`, error);
                    failCount++;
                }
            }));

            if (successCount > 0) message.success(`Successfully assigned ${successCount} shipments`);
            if (failCount > 0) message.error(`Failed to assign ${failCount} shipments`);
            
            setIsModalOpen(false);
            setSelectedRowKeys([]);
            setSelectedVehicle(null);
            fetchShipments(filters);
            fetchVehicles(); // Update vehicle capacities
        } catch (error) {
            message.error("Bulk assignment failed");
        } finally {
            setAssigning(false);
        }
    };

    const handleFilter = (newFilters) => {
        setFilters(newFilters);
        fetchShipments(newFilters);
    };

    const columns = [
        {
            title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking',
            render: (t, r) => <a onClick={() => navigate(`${basePath}/shipments/${r.id}`)}>{t}</a>
        },
        {
            title: 'Item', dataIndex: 'items', key: 'items',
            render: (items) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {items?.length > 0 ? items.map(i => (
                        <span key={i.id} style={{ fontSize: 13 }}>{i.name}</span>
                    )) : <span style={{ color: '#999' }}>-</span>}
                </div>
            )
        },
        { title: 'Pickup', dataIndex: 'pickup_address', key: 'pickup', ellipsis: true, width: 200 },
        { title: 'Drop', dataIndex: 'drop_address', key: 'drop', ellipsis: true, width: 200 },
        { title: 'Weight', dataIndex: 'total_weight', key: 'weight', render: v => `${v} kg`, width: 90 },
        { title: 'Volume', dataIndex: 'total_volume', key: 'volume', render: v => `${v} m³`, width: 90 },
        {
            title: 'Status', dataIndex: 'status', key: 'status', width: 120,
            render: s => <span style={{ fontWeight: 500 }}>{s.replace(/_/g, ' ')}</span>
        },
        {
            title: 'Created', dataIndex: 'created_at', key: 'created', width: 110,
            render: d => new Date(d).toLocaleDateString()
        },
        {
            title: '', key: 'actions', width: 100,
            render: (_, r) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`${basePath}/shipments/${r.id}`)} />
                    {['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(r.status) && (
                        <Button size="small" icon={<CompassOutlined />} onClick={() => navigate(`${basePath}/track/${r.id}`)} title="Track" />
                    )}
                </div>
            )
        },
    ];

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>All Shipments</Title>

            <AdvancedFilterBar
                onFilter={handleFilter}
                statusOptions={STATUS_OPTIONS}

            />

            {['SUPER_ADMIN', 'FLEET_MANAGER'].includes(user?.role) && selectedRowKeys.length > 0 && (
                <div style={{ marginBottom: 16, padding: '8px 16px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#a8071a', fontWeight: 500 }}>Selected {selectedRowKeys.length} items</span>
                    <Button type="primary" danger onClick={() => setIsModalOpen(true)}>
                        Assign / Reassign to Vehicle
                    </Button>
                </div>
            )}

            <Card bordered={false} bodyStyle={{ padding: 0 }}>
                <Table
                    rowSelection={['SUPER_ADMIN', 'FLEET_MANAGER'].includes(user?.role) ? rowSelection : undefined}
                    columns={columns}
                    dataSource={shipments}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                    scroll={{ x: 1000 }}
                />
            </Card>

            <Modal
                title="Bulk Assign Shipments"
                open={isModalOpen}
                onOk={handleBulkAssign}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={assigning}
                okText="Assign"
            >
                <p>Assign <b>{selectedRowKeys.length}</b> shipments to:</p>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Select a Vehicle"
                    onChange={setSelectedVehicle}
                    value={selectedVehicle}
                    options={vehicles.map(v => {
                        const remainingWt = v.weight_capacity - v.current_weight_used;
                        const remainingVol = v.volume_capacity - v.current_volume_used;
                        return {
                            value: v.id,
                            label: (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{v.plate_number} ({v.name})</span>
                                    <span style={{ fontSize: 11, color: '#999' }}>
                                        {v.current_driver_id ? 'Has Driver' : 'No Driver'} | {remainingWt}kg left
                                    </span>
                                </div>
                            ),
                            disabled: !v.current_driver_id // Disable vehicles without drivers
                        };
                    })}
                />
                {!selectedVehicle && <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>Only vehicles with assigned drivers are shown.</p>}
            </Modal>
        </div>
    );
}

