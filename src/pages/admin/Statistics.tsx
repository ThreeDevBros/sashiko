import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfYear,
  endOfYear
} from 'date-fns';
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ResponsiveChartCard } from '@/components/admin/ResponsiveChartCard';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function Statistics() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Revenue and orders analytics
  const { data: orderStats } = useQuery({
    queryKey: ['order-statistics', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'cancelled');
      
      if (error) throw error;

      const totalRevenue = data.reduce((sum, order) => sum + Number(order.total), 0);
      const totalOrders = data.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const ordersByType = data.reduce((acc, order) => {
        acc[order.order_type] = (acc[order.order_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ordersByStatus = data.reduce((acc, order) => {
        acc[order.status || 'pending'] = (acc[order.status || 'pending'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        ordersByType,
        ordersByStatus,
      };
    },
  });

  // Reservations analytics
  const { data: reservationStats } = useQuery({
    queryKey: ['reservation-statistics', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_reservations')
        .select('*')
        .gte('reservation_date', format(startDate, 'yyyy-MM-dd'))
        .lte('reservation_date', format(endDate, 'yyyy-MM-dd'));
      
      if (error) throw error;

      const totalReservations = data.length;
      const confirmedReservations = data.filter(r => r.status === 'confirmed').length;
      
      return {
        totalReservations,
        confirmedReservations,
      };
    },
  });

  // Top menu items
  const { data: topItems } = useQuery({
    queryKey: ['top-menu-items', startDate, endDate],
    queryFn: async () => {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity, menu_items(name, price)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!orderItems) return [];

      const itemSales = orderItems.reduce((acc, item) => {
        const itemId = item.menu_item_id;
        if (!itemId || !item.menu_items) return acc;

        if (!acc[itemId]) {
          acc[itemId] = {
            name: (item.menu_items as any).name,
            quantity: 0,
            revenue: 0,
          };
        }
        acc[itemId].quantity += item.quantity;
        acc[itemId].revenue += item.quantity * Number((item.menu_items as any).price);
        return acc;
      }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

      return Object.values(itemSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    },
  });

  // Branch performance
  const { data: branchStats } = useQuery({
    queryKey: ['branch-statistics', startDate, endDate],
    queryFn: async () => {
      const { data: branches } = await supabase.from('branches').select('id, name');
      if (!branches) return [];

      const branchData = await Promise.all(
        branches.map(async (branch) => {
          const { data: orders } = await supabase
            .from('orders')
            .select('total')
            .eq('branch_id', branch.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .neq('status', 'cancelled');

          const revenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
          const orderCount = orders?.length || 0;

          return {
            name: branch.name,
            revenue,
            orders: orderCount,
          };
        })
      );

      return branchData.sort((a, b) => b.revenue - a.revenue);
    },
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: `€${orderStats?.totalRevenue.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: 'Total Orders',
      value: orderStats?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      title: 'Avg Order Value',
      value: `€${orderStats?.avgOrderValue.toFixed(2) || '0.00'}`,
      icon: TrendingUp,
      color: 'text-orange-600',
    },
    {
      title: 'Reservations',
      value: reservationStats?.totalReservations || 0,
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  const orderTypeData = Object.entries(orderStats?.ordersByType || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
  }));

  const orderStatusData = Object.entries(orderStats?.ordersByStatus || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    orders: value,
  }));

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Restaurant Statistics</h1>
            <p className="text-muted-foreground">Orders, revenue, and restaurant performance metrics</p>
          </div>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2 min-w-0">
          {/* Order Types */}
          <ResponsiveChartCard
            title="Order Types Distribution"
            config={{ value: { label: 'Orders' } }}
          >
            <PieChart>
              <Pie
                data={orderTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="hsl(var(--primary))"
                dataKey="value"
              >
                {orderTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveChartCard>

          {/* Order Status */}
          <ResponsiveChartCard
            title="Order Status"
            config={{ orders: { label: 'Orders', color: 'hsl(var(--primary))' } }}
          >
            <BarChart data={orderStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orders" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveChartCard>
        </div>

        {/* Branch Performance */}
        <ResponsiveChartCard
          title="Branch Performance"
          config={{
            revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
            orders: { label: 'Orders', color: 'hsl(var(--secondary))' },
          }}
        >
          <BarChart data={branchStats || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" name="Revenue (€)" />
            <Bar yAxisId="right" dataKey="orders" fill="hsl(var(--secondary))" name="Orders" />
          </BarChart>
        </ResponsiveChartCard>

        {/* Top Menu Items */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Menu Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topItems?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">€{item.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
