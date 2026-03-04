
import React, { useState, useEffect } from 'react';
import { Form, Select, DatePicker, Button, Space, Input, Card, Checkbox, Row, Col } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const { RangePicker } = DatePicker;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AdvancedFilterBar = ({ onFilter, statusOptions, initialValues }) => {
    const [form] = Form.useForm();
    const { user, token } = useAuth();
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);

    const isAdminOrFleet = user?.role === 'ADMIN';

    useEffect(() => {
        if (isAdminOrFleet && token) {
            const headers = { Authorization: `Bearer ${token}` };
            axios.get(`${API}/users`, { headers }).then(res => {
                setDrivers(res.data.filter(u => u.role === 'DRIVER').map(d => ({ label: d.name, value: d.id })));
            }).catch(err => console.error(err));

            axios.get(`${API}/vehicles`, { headers }).then(res => {
                setVehicles(res.data.map(v => ({ label: `${v.plate_number} (${v.vehicle_type})`, value: v.id })));
            }).catch(err => console.error(err));
        }
    }, [isAdminOrFleet, token]);

    const handleFinish = (values) => {
        const filters = { ...values };
        if (values.dateRange) {
            filters.date_from = values.dateRange[0].format('YYYY-MM-DD');
            filters.date_to = values.dateRange[1].format('YYYY-MM-DD');
            delete filters.dateRange;
        }
        onFilter(filters);
    };

    const handleReset = () => {
        form.resetFields();
        onFilter({});
    };

    return (
        <Card bodyStyle={{ padding: 16 }} style={{ marginBottom: 16 }}>
            <Form
                form={form}
                layout="inline"
                onFinish={handleFinish}
                initialValues={initialValues}
            >
                <Space wrap size={[8, 16]}>
                    <Form.Item name="q" noStyle>
                        <Input
                            className="global-search-input"
                            placeholder="Search Shipments..."
                            prefix={<SearchOutlined style={{ color: '#facc15' }} />}
                            style={{ width: 280, borderRadius: '50px' }}
                            allowClear
                        />
                    </Form.Item>

                    <Form.Item name="status" noStyle>
                        <Select
                            mode="multiple"
                            placeholder="Status"
                            style={{ minWidth: 160 }}
                            options={statusOptions}
                            allowClear
                            maxTagCount="responsive"
                        />
                    </Form.Item>

                    <Form.Item name="dateRange" noStyle>
                        <RangePicker
                            style={{ width: 260, borderRadius: '50px' }}
                            format="YYYY-MM-DD"
                        />
                    </Form.Item>

                    {isAdminOrFleet && (
                        <>
                            <Form.Item name="driver_id" noStyle>
                                <Select placeholder="Driver" options={drivers} allowClear style={{ width: 150 }} showSearch optionFilterProp="label" />
                            </Form.Item>
                            <Form.Item name="vehicle_id" noStyle>
                                <Select placeholder="Vehicle" options={vehicles} allowClear style={{ width: 160 }} showSearch optionFilterProp="label" />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item name="delayed" valuePropName="checked" noStyle>
                        <Checkbox>Delayed</Checkbox>
                    </Form.Item>

                    <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
                        Filter
                    </Button>
                    <Button onClick={handleReset} icon={<ClearOutlined />}>
                        Reset
                    </Button>
                </Space>
            </Form>
        </Card>
    );
};

export default AdvancedFilterBar;
