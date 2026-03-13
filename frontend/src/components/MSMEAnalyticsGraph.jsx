import React from 'react';
import { Card, Typography, Radio, Button, Space } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MSMEAnalyticsGraph = ({ data }) => {
    // Process data to get daily counts or use provided data
    // For now, assuming data passed is already in format [{ date: '2023-01-01', count: 5 }]
    // If not, we'd process it here. Integrating mock data if empty for visualization.

    const [timeRange, setTimeRange] = React.useState('week');
    const [baseDate, setBaseDate] = React.useState(new Date());

    const mockData = {
        week: [
            { date: 'Mon', count: 2 }, { date: 'Tue', count: 4 }, { date: 'Wed', count: 8 },
            { date: 'Thu', count: 6 }, { date: 'Fri', count: 12 }, { date: 'Sat', count: 9 }, { date: 'Sun', count: 15 },
        ],
        month: [
            { date: 'Week 1', count: 45 }, { date: 'Week 2', count: 52 },
            { date: 'Week 3', count: 38 }, { date: 'Week 4', count: 65 },
        ],
        year: [
            { date: 'Jan', count: 120 }, { date: 'Feb', count: 135 }, { date: 'Mar', count: 160 },
            { date: 'Apr', count: 140 }, { date: 'May', count: 180 }, { date: 'Jun', count: 210 },
            { date: 'Jul', count: 220 }, { date: 'Aug', count: 200 }, { date: 'Sep', count: 240 },
            { date: 'Oct', count: 260 }, { date: 'Nov', count: 280 }, { date: 'Dec', count: 310 },
        ]
    };

    const handlePrev = () => {
        const newDate = new Date(baseDate);
        if (timeRange === 'week') newDate.setDate(newDate.getDate() - 7);
        else if (timeRange === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else if (timeRange === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
        setBaseDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(baseDate);
        if (timeRange === 'week') newDate.setDate(newDate.getDate() + 7);
        else if (timeRange === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else if (timeRange === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
        setBaseDate(newDate);
    };

    const getRangeLabel = () => {
        if (timeRange === 'week') {
            const start = new Date(baseDate);
            start.setDate(start.getDate() - 6);
            return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${baseDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        }
        if (timeRange === 'month') return baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (timeRange === 'year') return baseDate.getFullYear().toString();
    };

    const processData = (rawData, range, currentBase) => {
        if (!rawData || rawData.length === 0) return mockData[range];

        const processed = [];

        if (range === 'week') {
            // Last 7 days ending at currentBase
            for (let i = 6; i >= 0; i--) {
                const d = new Date(currentBase);
                d.setDate(d.getDate() - i);
                const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
                const count = rawData.filter(s => {
                    const sDate = new Date(s.created_at);
                    return sDate.toLocaleDateString() === d.toLocaleDateString();
                }).length;
                processed.push({ date: dayStr, count });
            }
        } else if (range === 'month') {
            // Weeks of the specific month in currentBase
            const year = currentBase.getFullYear();
            const month = currentBase.getMonth();
            const startOfMonth = new Date(year, month, 1);

            // Generate 4-5 weeks for the month
            for (let i = 1; i <= 5; i++) {
                const weekStart = new Date(startOfMonth);
                weekStart.setDate((i - 1) * 7 + 1);

                // If week start is in next month, stop
                if (weekStart.getMonth() !== month) break;

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 7);

                const count = rawData.filter(s => {
                    const sDate = new Date(s.created_at);
                    return sDate >= weekStart && sDate < weekEnd;
                }).length;
                processed.push({ date: `Week ${i}`, count });
            }
        } else if (range === 'year') {
            // Months of the specific year in currentBase
            const year = currentBase.getFullYear();
            for (let i = 0; i < 12; i++) {
                const monthDate = new Date(year, i, 1);
                const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short' });
                const count = rawData.filter(s => {
                    const sDate = new Date(s.created_at);
                    return sDate.getMonth() === i && sDate.getFullYear() === year;
                }).length;
                processed.push({ date: monthStr, count });
            }
        }

        // Return processed data if it has any non-zero counts, or if we want to show real 0s. 
        // If the array is all 0s, maybe we still want to show the graph lines at 0.
        return processed;
    };

    const chartData = processData(data, timeRange, baseDate);
    const allZero = chartData.every(d => d.count === 0);

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ marginRight: 8 }}>Shipment Trends</span>
                    <Space>
                        <Button shape="circle" icon={<LeftOutlined />} size="small" onClick={handlePrev} />
                        <Text strong style={{ minWidth: 100, textAlign: 'center' }}>{getRangeLabel()}</Text>
                        <Button shape="circle" icon={<RightOutlined />} size="small" onClick={handleNext} />
                    </Space>
                </div>
            }
            extra={
                <Radio.Group value={timeRange} onChange={e => { setTimeRange(e.target.value); setBaseDate(new Date()); }} size="small" buttonStyle="solid">
                    <Radio.Button value="week">Week</Radio.Button>
                    <Radio.Button value="month">Month</Radio.Button>
                    <Radio.Button value="year">Year</Radio.Button>
                </Radio.Group>
            }
            bordered={false}
            style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        >
            <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                                {/* Side full red (#facc15) to peach (#93c5fd) */}
                                <stop offset="5%" stopColor="#facc15" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.8} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c' }} />
                        <Tooltip
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Area
                            type={allZero ? "linear" : "monotone"}
                            dataKey="count"
                            stroke="#facc15"
                            fillOpacity={1}
                            fill="url(#colorCount)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default MSMEAnalyticsGraph;
