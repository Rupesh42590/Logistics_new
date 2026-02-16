import { useState, useEffect } from 'react';
import {
    Card, DatePicker, Select, Button, Form,
    Typography, Row, Col, Table, Tag, message
} from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilterOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { SHIPMENT_STATUS_COLORS } from '../utils/statusColors';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Reports() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [drivers, setDrivers] = useState([]);

    // Filters
    const [filters, setFilters] = useState({});

    useEffect(() => {
        // Load drivers for filter
        axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setDrivers(res.data.filter(u => u.role === 'DRIVER')))
            .catch(err => console.error(err));
    }, [token]);

    const handleExport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.driver_id) params.append('driver_id', filters.driver_id);
            if (filters.dateRange) {
                params.append('start_date', filters.dateRange[0].format('YYYY-MM-DD'));
                params.append('end_date', filters.dateRange[1].format('YYYY-MM-DD'));
            }

            const response = await axios.get(`${API}/admin/reports/export`, {
                params: params,
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob', // Important for file download
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'shipments_report.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('Report exported successfully');
        } catch (error) {
            console.error("Export failed", error);
            message.error('Failed to export report');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'Report Type', dataIndex: 'type', key: 'type' },
        { title: 'Description', dataIndex: 'desc', key: 'desc' },
        { title: 'Format', dataIndex: 'format', key: 'format', render: () => <Text>CSV</Text> },
        {
            title: 'Action',
            key: 'action',
            render: () => <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={loading}>Download</Button>
        }
    ];

    const data = [
        { key: '1', type: 'Shipment History', desc: 'Detailed log of all shipments with status and assignment.' },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>Reports & Export</Title>
            <Text type="secondary">Generate and download operational reports.</Text>

            <Card style={{ marginTop: 24 }}>
                <Form layout="inline" onValuesChange={(_, allValues) => setFilters(allValues)}>
                    <Form.Item name="dateRange" label="Date Range">
                        <RangePicker />
                    </Form.Item>
                    <Form.Item name="status" label="Status" style={{ minWidth: 150 }}>
                        <Select placeholder="All Statuses" allowClear>
                            {Object.keys(SHIPMENT_STATUS_COLORS).map(s => (
                                <Select.Option key={s} value={s}>{s}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="driver_id" label="Driver" style={{ minWidth: 150 }}>
                        <Select placeholder="All Drivers" allowClear>
                            {drivers.map(d => (
                                <Select.Option key={d.id} value={d.id}>{d.name || d.email}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>

                <Table
                    columns={columns}
                    dataSource={data}
                    style={{ marginTop: 24 }}
                    pagination={false}
                />
            </Card>
        </div>
    );
}
