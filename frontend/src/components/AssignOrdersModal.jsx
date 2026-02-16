import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Card, List, Button, Tag, message, Typography, Input, Divider, Space, Badge } from 'antd';
import { SearchOutlined, UserOutlined, CarOutlined, ArrowRightOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AssignOrdersModal({ open, onCancel, mode = 'PENDING', onSuccess }) {
    const { token } = useAuth();
    const headers = { Authorization: `Bearer ${token}` };

    const [orders, setOrders] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Selection state
    const [selectedOrders, setSelectedOrders] = useState([]); // Array of IDs
    const [selectedVehicle, setSelectedVehicle] = useState(null); // ID

    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (open) {
            fetchData();
            setSelectedOrders([]);
            setSelectedVehicle(null);
        }
    }, [open, mode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Orders
            const statusParams = mode === 'PENDING' ? 'PENDING' : 'ASSIGNED'; // For reassign, maybe different?
            // If mode is 'reassign', maybe we fetch ASSIGNED, IN_TRANSIT? 
            // User likely wants to reassign ASSIGNED ones.
            
            const ordersRes = await axios.get(`${API}/shipments?status=${statusParams}`, { headers });
            setOrders(ordersRes.data);

            // Fetch Vehicles
            const vehiclesRes = await axios.get(`${API}/vehicles`, { headers });
            // For assignment, we need vehicles with drivers?
            // Usually yes.
            setVehicles(vehiclesRes.data);
        } catch (error) {
            console.error(error);
            message.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (selectedOrders.length === 0 || !selectedVehicle) return;
        
        const vehicle = vehicles.find(v => v.id === selectedVehicle);
        if (!vehicle || !vehicle.current_driver_id) {
            message.error("Selected vehicle has no driver assigned.");
            return;
        }

        setAssigning(true);
        let successCount = 0;
        
        try {
            await Promise.all(selectedOrders.map(async (orderId) => {
                await axios.post(`${API}/shipments/${orderId}/assign`, {
                    vehicle_id: vehicle.id,
                    driver_id: vehicle.current_driver_id
                }, { headers });
                successCount++;
            }));
            
            message.success(`Assigned ${successCount} orders successfully`);
            if (onSuccess) onSuccess();
            onCancel();
        } catch (error) {
            message.error("Failed to assign some orders");
        } finally {
            setAssigning(false);
        }
    };

    const toggleOrder = (id) => {
        setSelectedOrders(prev => 
            prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
        );
    };

    return (
        <Modal
            title={mode === 'PENDING' ? "Assign Pending Orders" : "Reassign Orders"}
            open={open}
            onCancel={onCancel}
            width={1000}
            footer={[
                <Button key="cancel" onClick={onCancel}>Cancel</Button>,
                <Button 
                    key="submit" 
                    type="primary" 
                    loading={assigning} 
                    onClick={handleAssign}
                    disabled={selectedOrders.length === 0 || !selectedVehicle}
                >
                    Assign {selectedOrders.length} Order{selectedOrders.length !== 1 ? 's' : ''} to Vehicle
                </Button>
            ]}
        >
            <Row gutter={24} style={{ height: '60vh' }}>
                {/* LEFT: Orders */}
                <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 16 }}>
                        <Title level={5}>1. Select Orders ({orders.length})</Title>
                        <Input prefix={<SearchOutlined />} placeholder="Search orders..." />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                        <List
                            dataSource={orders}
                            loading={loading}
                            renderItem={item => {
                                const isSelected = selectedOrders.includes(item.id);
                                return (
                                    <List.Item 
                                        onClick={() => toggleOrder(item.id)}
                                        style={{ 
                                            cursor: 'pointer', 
                                            padding: 12,
                                            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                                            borderBottom: '1px solid #f0f0f0'
                                        }}
                                    >
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text strong>{item.tracking_number}</Text>
<Text>{item.status}</Text>                                            </div>
                                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                                <div>Pickup: {item.pickup_address}</div>
                                                <div>Drop: {item.drop_address}</div>
                                                <div style={{ marginTop: 4 }}>
                                                    <Badge status="processing" text={`${item.total_weight} kg`} />
                                                    <span style={{ margin: '0 8px' }}>|</span>
                                                    <Badge status="warning" text={`${item.total_volume} m³`} />
                                                </div>
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </div>
                </Col>

                {/* RIGHT: Vehicles */}
                <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 16 }}>
                        <Title level={5}>2. Select Vehicle ({vehicles.length})</Title>
                        <Input prefix={<CarOutlined />} placeholder="Search vehicles..." />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                        <List
                            dataSource={vehicles}
                            loading={loading}
                            renderItem={item => {
                                const isSelected = selectedVehicle === item.id;
                                const hasDriver = !!item.current_driver_id;
                                const remainingWt = item.weight_capacity - item.current_weight_used;

                                return (
                                    <List.Item 
                                        onClick={() => hasDriver && setSelectedVehicle(item.id)}
                                        style={{ 
                                            cursor: hasDriver ? 'pointer' : 'not-allowed', 
                                            padding: 12,
                                            backgroundColor: isSelected ? '#f6ffed' : 'transparent',
                                            opacity: hasDriver ? 1 : 0.5,
                                            borderBottom: '1px solid #f0f0f0'
                                        }}
                                    >
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text strong>{item.plate_number}</Text>
                                                {isSelected && <Tag color="green">Selected</Tag>}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                                <div><CarOutlined /> {item.name}</div>
                                                <div><UserOutlined /> {hasDriver ? 'Has Driver' : 'No Driver'}</div>
                                                <div style={{ marginTop: 4, color: remainingWt < 0 ? 'red' : 'green' }}>
                                                    Capacity Left: {remainingWt} kg
                                                </div>
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </div>
                </Col>
            </Row>
        </Modal>
    );
}
