import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  format, 
  startOfMonth, 
  endOfMonth,
  startOfYear,
  endOfYear
} from 'date-fns';
import { Users, Building2, Activity } from 'lucide-react';

export default function Reports() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // User activity
  const { data: userActivity } = useQuery({
    queryKey: ['user-activity', startDate, endDate],
    queryFn: async () => {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, created_at');
      
      if (error) throw error;

      const newUsers = users.filter(u => 
        new Date(u.created_at!) >= startDate && new Date(u.created_at!) <= endDate
      ).length;

      const { data: orders } = await supabase
        .from('orders')
        .select('user_id')
        .not('user_id', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const activeUsers = new Set(orders?.map(o => o.user_id)).size;

      return {
        totalUsers: users.length,
        newUsers,
        activeUsers,
      };
    },
  });

  // Branch activity
  const { data: branchActivity } = useQuery({
    queryKey: ['branch-activity', startDate, endDate],
    queryFn: async () => {
      const { data: branches } = await supabase.from('branches').select('*');
      if (!branches) return [];

      const branchData = await Promise.all(
        branches.map(async (branch) => {
          const [orders, reservations] = await Promise.all([
            supabase
              .from('orders')
              .select('*', { count: 'exact' })
              .eq('branch_id', branch.id)
              .gte('created_at', startDate.toISOString())
              .lte('created_at', endDate.toISOString()),
            supabase
              .from('table_reservations')
              .select('*', { count: 'exact' })
              .eq('branch_id', branch.id)
              .gte('reservation_date', format(startDate, 'yyyy-MM-dd'))
              .lte('reservation_date', format(endDate, 'yyyy-MM-dd')),
          ]);

          return {
            name: branch.name,
            city: branch.city,
            isActive: branch.is_active,
            orders: orders.count || 0,
            reservations: reservations.count || 0,
          };
        })
      );

      return branchData;
    },
  });

  const summaryCards = [
    {
      title: 'Total Users',
      value: userActivity?.totalUsers || 0,
      subtitle: `${userActivity?.newUsers || 0} new this ${period}`,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Active Users',
      value: userActivity?.activeUsers || 0,
      subtitle: 'Users with orders',
      icon: Activity,
      color: 'text-green-600',
    },
    {
      title: 'Total Branches',
      value: branchActivity?.length || 0,
      subtitle: `${branchActivity?.filter(b => b.isActive).length || 0} active`,
      icon: Building2,
      color: 'text-orange-600',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">App Reports</h1>
            <p className="text-muted-foreground">User activity, branches, and app-related metrics</p>
          </div>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="branches" className="space-y-4">
          <TabsList>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Branch Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Reservations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchActivity?.map((branch, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>{branch.city}</TableCell>
                        <TableCell>
                          <Badge variant={branch.isActive ? 'default' : 'secondary'}>
                            {branch.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{branch.orders}</TableCell>
                        <TableCell className="text-right">{branch.reservations}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{userActivity?.totalUsers || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">New Users</p>
                    <p className="text-2xl font-bold">{userActivity?.newUsers || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold">{userActivity?.activeUsers || 0}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Engagement Rate</p>
                  <p className="text-2xl font-bold">
                    {userActivity?.totalUsers 
                      ? ((userActivity.activeUsers / userActivity.totalUsers) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}