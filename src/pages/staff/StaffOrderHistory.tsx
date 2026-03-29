import { useState, useEffect } from 'react';
import { formatOrderDisplayNumber } from '@/lib/orderNumber';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/staff/StaffLayout';
import { useStaffBranch } from '@/contexts/StaffBranchContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, startOfWeek } from 'date-fns';
import { Search, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';

const statusColors: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const COMPLETED_STATUSES = ['delivered', 'cancelled'] as const;

type DatePreset = 'today' | 'yesterday' | 'week' | 'all' | 'custom';

export default function StaffOrderHistory() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { selectedBranchId: staffBranchId } = useStaffBranch();

  useEffect(() => {
    const channel = supabase
      .channel('staff-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['staff-order-history', staffBranchId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, staffBranchId]);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      setDateFrom(startOfDay(now));
      setDateTo(endOfDay(now));
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      setDateFrom(startOfDay(yesterday));
      setDateTo(endOfDay(yesterday));
    } else if (preset === 'week') {
      setDateFrom(startOfWeek(now, { weekStartsOn: 1 }));
      setDateTo(endOfDay(now));
    } else if (preset === 'all') {
      setDateFrom(undefined);
      setDateTo(undefined);
    }
  };

  const { data: orders, isLoading } = useQuery({
    queryKey: ['staff-order-history', staffBranchId],
    queryFn: async () => {
      if (!staffBranchId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`*, profiles:user_id(full_name), branches:branch_id(name)`)
        .in('status', COMPLETED_STATUSES)
        .eq('branch_id', staffBranchId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!staffBranchId,
  });

  const filteredOrders = orders?.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      order.guest_name?.toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
    const orderDate = new Date(order.created_at);
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom;
    const matchesDateTo = !dateTo || orderDate <= dateTo;
    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDatePreset('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || datePreset !== 'all';

  return (
    <StaffLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Order History</h1>
          <p className="text-muted-foreground text-xs">Completed and rejected orders</p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search order #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date presets */}
            <div className="flex rounded-lg border overflow-hidden">
              {([
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'week', label: 'This Week' },
              ] as { key: DatePreset; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => applyDatePreset(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    datePreset === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom date pickers */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", datePreset === 'custom' && "border-primary")}>
                  <CalendarIcon className="h-3 w-3" />
                  {dateFrom && datePreset === 'custom' ? format(dateFrom, "MMM d") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d ? startOfDay(d) : undefined); setDatePreset('custom'); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", datePreset === 'custom' && "border-primary")}>
                  <CalendarIcon className="h-3 w-3" />
                  {dateTo && datePreset === 'custom' ? format(dateTo, "MMM d") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d ? endOfDay(d) : undefined); setDatePreset('custom'); }} initialFocus disabled={(date) => dateFrom ? date < dateFrom : false} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            {/* Status & Type filters */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="dine_in">Dine In</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              {filteredOrders?.length || 0} of {orders?.length || 0} orders
            </p>
          )}
        </div>

        {/* Orders Table */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Order #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Branch</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs py-2.5">#{formatOrderDisplayNumber(order.display_number)}</TableCell>
                    <TableCell className="text-xs py-2.5">{order.profiles?.full_name || order.guest_name || 'Guest'}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{order.order_type.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2.5">{order.branches?.name || '—'}</TableCell>
                    <TableCell className="text-xs font-medium py-2.5 text-right">{formatCurrency(Number(order.total))}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge className={cn("text-[10px] px-1.5 py-0", statusColors[order.status || ''])}>
                        {order.status === 'cancelled' ? 'Rejected' : order.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs py-2.5 text-muted-foreground">{format(new Date(order.created_at), 'MMM dd, HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">No completed orders found</div>
        )}
      </div>
    </StaffLayout>
  );
}
