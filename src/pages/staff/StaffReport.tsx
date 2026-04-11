import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/staff/StaffLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ShoppingCart, DollarSign, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useStaffBranch } from '@/contexts/StaffBranchContext';

function StaffReportContent() {
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const { selectedBranchId: staffBranchId } = useStaffBranch();

  // Today's orders
  const { data: todayOrders } = useQuery({
    queryKey: ['staff-report-today', staffBranchId],
    queryFn: async () => {
      if (!staffBranchId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(*, menu_items:menu_item_id(name))`)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .eq('branch_id', staffBranchId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!staffBranchId,
  });

  const totalOrders = todayOrders?.length || 0;
  const completedOrders = todayOrders?.filter(o => o.status === 'delivered').length || 0;
  const cancelledOrders = todayOrders?.filter(o => o.status === 'cancelled').length || 0;
  const totalRevenue = todayOrders
    ?.filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / (totalOrders - cancelledOrders || 1) : 0;

  // Popular items today
  const itemCounts: Record<string, { name: string; count: number }> = {};
  todayOrders?.forEach(order => {
    order.order_items?.forEach((item: any) => {
      const name = item.menu_items?.name || 'Unknown';
      if (!itemCounts[name]) itemCounts[name] = { name, count: 0 };
      itemCounts[name].count += item.quantity;
    });
  });
  const popularItems = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Orders by type
  const deliveryCount = todayOrders?.filter(o => o.order_type === 'delivery').length || 0;
  const pickupCount = todayOrders?.filter(o => o.order_type === 'pickup').length || 0;
  const dineInCount = todayOrders?.filter(o => o.order_type === 'dine_in').length || 0;

  // Orders by status
  const pendingCount = todayOrders?.filter(o => o.status === 'pending').length || 0;
  const preparingCount = todayOrders?.filter(o => o.status === 'preparing').length || 0;
  const readyCount = todayOrders?.filter(o => o.status === 'ready').length || 0;

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Daily Report</h1>
          <p className="text-muted-foreground text-sm">{format(today, 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
                  <p className="text-xs text-muted-foreground">Avg Order</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedOrders}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders by Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Orders by Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Delivery', count: deliveryCount, color: 'bg-primary' },
                { label: 'Pickup', count: pickupCount, color: 'bg-blue-500' },
                { label: 'Dine In', count: dineInCount, color: 'bg-purple-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Current Status Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Pending', count: pendingCount, color: 'bg-yellow-500' },
                { label: 'Preparing', count: preparingCount, color: 'bg-purple-500' },
                { label: 'Ready', count: readyCount, color: 'bg-green-500' },
                { label: 'Delivered', count: completedOrders, color: 'bg-muted-foreground' },
                { label: 'Rejected', count: cancelledOrders, color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Popular Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Popular Items Today</CardTitle>
          </CardHeader>
          <CardContent>
            {popularItems.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">No orders yet today</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {popularItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">{item.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

export default function StaffReport() {
  return (
    <StaffLayout>
      <StaffReportContent />
    </StaffLayout>
  );
}
