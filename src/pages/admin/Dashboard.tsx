import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, ShoppingCart, UtensilsCrossed, Users, TrendingUp, Database } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ResponsiveChartCard } from '@/components/admin/ResponsiveChartCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTestData = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test-data');
      
      if (error) throw error;
      
      toast.success('Test data generated successfully!', {
        description: `Created ${data.stats.branches} branches, ${data.stats.categories} categories, and ${data.stats.menuItems} menu items`,
      });
      
      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      console.error('Error generating test data:', error);
      toast.error('Failed to generate test data', {
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Today's quick stats
  const { data: todayStats } = useQuery({
    queryKey: ['today-stats'],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      const [orders, reservations] = await Promise.all([
        supabase
          .from('orders')
          .select('total, status')
          .gte('created_at', startOfToday.toISOString())
          .lte('created_at', endOfToday.toISOString()),
        supabase
          .from('table_reservations')
          .select('*', { count: 'exact' })
          .eq('reservation_date', format(today, 'yyyy-MM-dd')),
      ]);

      const todayRevenue = orders.data?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      const todayOrders = orders.data?.length || 0;
      const pendingOrders = orders.data?.filter(o => o.status === 'pending').length || 0;
      const todayReservations = reservations.count || 0;

      return {
        todayRevenue,
        todayOrders,
        pendingOrders,
        todayReservations,
      };
    },
  });

  // Overall stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [orders, menuItems, branches] = await Promise.all([
        supabase.from('orders').select('total', { count: 'exact' }),
        supabase.from('menu_items').select('*', { count: 'exact' }),
        supabase.from('branches').select('*', { count: 'exact' }),
      ]);

      const totalRevenue = orders.data?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      return {
        revenue: totalRevenue,
        orders: orders.count || 0,
        menuItems: menuItems.count || 0,
        branches: branches.count || 0,
      };
    },
  });

  // Last 7 days revenue chart
  const { data: revenueChart } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: async () => {
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const start = startOfDay(date);
        const end = endOfDay(date);

        const { data } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .neq('status', 'cancelled');

        const revenue = data?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
        chartData.push({
          date: format(date, 'MMM dd'),
          revenue: Number(revenue.toFixed(2)),
        });
      }
      return chartData;
    },
  });

  // Order types distribution
  const { data: orderTypes } = useQuery({
    queryKey: ['order-types'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_type')
        .neq('status', 'cancelled');

      const types = data?.reduce((acc, order) => {
        const type = order.order_type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(types || {}).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        orders: value,
      }));
    },
  });

  const todayCards = [
    {
      title: "Today's Revenue",
      value: `€${todayStats?.todayRevenue.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: "Today's Orders",
      value: todayStats?.todayOrders || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      title: 'Pending Orders',
      value: todayStats?.pendingOrders || 0,
      icon: TrendingUp,
      color: 'text-orange-600',
    },
    {
      title: "Today's Reservations",
      value: todayStats?.todayReservations || 0,
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  const overallCards = [
    {
      title: 'Total Revenue',
      value: `€${stats?.revenue.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: 'Total Orders',
      value: stats?.orders || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      title: 'Menu Items',
      value: stats?.menuItems || 0,
      icon: UtensilsCrossed,
      color: 'text-orange-600',
    },
    {
      title: 'Branches',
      value: stats?.branches || 0,
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your restaurant operations</p>
          </div>
          <Button
            onClick={handleGenerateTestData}
            disabled={isGenerating}
            className="gap-2"
            variant="outline"
          >
            <Database className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate Test Data'}
          </Button>
        </div>

        {/* Today's Quick Stats */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Today's Overview</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {todayCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Revenue Chart */}
        <ResponsiveChartCard
          title="Revenue Trend (Last 7 Days)"
          config={{ revenue: { label: 'Revenue', color: 'hsl(var(--primary))' } }}
        >
          <LineChart data={revenueChart || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Revenue (€)"
            />
          </LineChart>
        </ResponsiveChartCard>

        {/* Order Types Distribution */}
        <ResponsiveChartCard
          title="Order Types Distribution"
          config={{ orders: { label: 'Orders', color: 'hsl(var(--primary))' } }}
        >
          <BarChart data={orderTypes || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar 
              dataKey="orders" 
              fill="hsl(var(--primary))" 
              name="Orders"
            />
          </BarChart>
        </ResponsiveChartCard>

        {/* Overall Stats */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Overall Statistics</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {overallCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
