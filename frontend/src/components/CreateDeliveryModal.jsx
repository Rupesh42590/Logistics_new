import { API_BASE_URL } from '../apiConfig';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Button,
    Space,
    Typography,
    Divider,
    Upload,
    message,
    InputNumber,
    Row,
    Col,
} from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    UploadOutlined,
    InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function CreateDeliveryModal({ onClose, onSuccess }) {
    const { user } = useAuth();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [file, setFile] = useState(null);
    const [items, setItems] = useState([
        { material_name: '', quantity_expected: '', unit: 'units' },
    ]);

    useEffect(() => {
        if (user?.role === 'ADMIN') {
            axios
                .get(`${API_BASE_URL}/vendors`)
                .then((res) => setVendors(res.data))
                .catch((err) => console.error('Failed to fetch vendors', err));
        }
    }, [user]);

    const handleAddItem = () => {
        setItems([...items, { material_name: '', quantity_expected: '', unit: 'units' }]);
    };

    const handleRemoveItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (values) => {
        if (items.length === 0 || items.some((i) => !i.material_name || !i.quantity_expected)) {
            message.error('All manifest items must be filled out');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                po_number: values.po_number,
                expected_arrival: values.expected_arrival?.toISOString(),
                vendor_id: values.vendor_id || undefined,
                vehicle_number: values.vehicle_number || undefined,
                driver_name: values.driver_name || undefined,
                driver_phone: values.driver_phone || undefined,
                items: items.map((item) => ({
                    ...item,
                    quantity_expected: parseFloat(item.quantity_expected),
                })),
            };

            const res = await axios.post(`${API_BASE_URL}/deliveries`, payload);
            const deliveryId = res.data.id;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                await axios.post(`${API_BASE_URL}/deliveries/${deliveryId}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }

            message.success('Delivery created successfully');
            onSuccess();
        } catch (err) {
            console.error(err);
            message.error(err.response?.data?.detail || 'Failed to create delivery');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open
            title={user?.role === 'ADMIN' ? 'Create New Delivery' : 'Create New ASN'}
            onCancel={onClose}
            onOk={() => form.submit()}
            confirmLoading={loading}
            okText="Create ASN"
            width={720}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
                <Divider orientation="left" orientationMargin={0}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Shipment Details
                    </Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="po_number" label="PO Number" rules={[{ required: true, message: 'PO Number is required' }]}>
                            <Input placeholder="e.g. PO-2023-001" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="expected_arrival" label="Expected Arrival" rules={[{ required: true, message: 'Expected arrival is required' }]}>
                            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                {user?.role === 'ADMIN' && (
                    <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true, message: 'Vendor is required' }]}>
                        <Select placeholder="Select Vendor">
                            {vendors.map((v) => (
                                <Select.Option key={v.id} value={v.id}>
                                    {v.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}

                <Divider orientation="left" orientationMargin={0}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Transport (Optional)
                    </Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="vehicle_number" label="Vehicle Number">
                            <Input placeholder="MH-12-AB-1234" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="driver_name" label="Driver Name">
                            <Input placeholder="Driver name" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="driver_phone" label="Driver Phone">
                            <Input placeholder="+91..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left" orientationMargin={0}>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Manifest Items
                        </Text>
                        <Button type="link" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>
                            Add Item
                        </Button>
                    </Space>
                </Divider>

                <div
                    style={{
                        background: '#fafafa',
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        padding: 16,
                    }}
                >
                    {items.map((item, idx) => (
                        <Row gutter={12} key={idx} style={{ marginBottom: idx < items.length - 1 ? 12 : 0 }}>
                            <Col flex="auto">
                                <Input
                                    placeholder="Material description"
                                    value={item.material_name}
                                    onChange={(e) => handleItemChange(idx, 'material_name', e.target.value)}
                                    size="small"
                                />
                            </Col>
                            <Col style={{ width: 100 }}>
                                <InputNumber
                                    placeholder="Qty"
                                    min={0.01}
                                    step={0.01}
                                    value={item.quantity_expected}
                                    onChange={(val) => handleItemChange(idx, 'quantity_expected', val)}
                                    size="small"
                                    style={{ width: '100%' }}
                                />
                            </Col>
                            <Col style={{ width: 100 }}>
                                <Select
                                    value={item.unit}
                                    onChange={(val) => handleItemChange(idx, 'unit', val)}
                                    size="small"
                                    style={{ width: '100%' }}
                                >
                                    <Select.Option value="units">Units</Select.Option>
                                    <Select.Option value="kg">kg</Select.Option>
                                    <Select.Option value="tonnes">Tonnes</Select.Option>
                                    <Select.Option value="boxes">Boxes</Select.Option>
                                    <Select.Option value="pallets">Pallets</Select.Option>
                                </Select>
                            </Col>
                            {items.length > 1 && (
                                <Col>
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemoveItem(idx)}
                                    />
                                </Col>
                            )}
                        </Row>
                    ))}
                </div>

                <Divider orientation="left" orientationMargin={0} style={{ marginTop: 24 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Attachments
                    </Text>
                </Divider>

                <Upload
                    beforeUpload={(f) => {
                        setFile(f);
                        return false;
                    }}
                    maxCount={1}
                    onRemove={() => setFile(null)}
                    accept=".pdf,.jpg,.jpeg,.png"
                >
                    <Button icon={<UploadOutlined />}>Select File (PDF, JPG, PNG)</Button>
                </Upload>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    Optional. Max 5MB. Invoice or packing list.
                </Text>
            </Form>
        </Modal>
    );
}
