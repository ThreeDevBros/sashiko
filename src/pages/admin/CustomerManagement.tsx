import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  UserCircle, MapPin, Search, ArrowLeft, ShoppingBag,
  CalendarDays, Wallet, BarChart3, Info, Plus, Minus,
  Mail, Phone, Clock, Package, TrendingUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ─── Status colors ───
const orderStatusColor = (status: string) => {
  const s = status?.toLowerCase().replace('_', ' ');
  if (s === 'delivered' || s === 'completed') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (s === 'pending') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (s === 'preparing' || s === 'confirmed') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (s === 'cancelled' || s === 'refunded') return 'bg-destructive/10 text-destructive border-destructive/20';
  return 'bg-muted text-muted-foreground';
};

const reservationStatusColor = (status: string) => {
  if (status === 'confirmed') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (status === 'pending') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (status === 'cancelled' || status === 'no_show') return 'bg-destructive/10 text-destructive border-destructive/20';
  return 'bg-green-500/10 text-green-600 border-green-500/20';
};

export default function CustomerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletAction, setWalletAction] = useState<'add' | 'remove'>('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');

  // ─── Queries ───
  const { data: customerEmails = [] } = useQuery({
    queryKey: ['customer-emails', isAdmin],
    enabled: !permissionsLoading && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-customer-emails');
      if (error) {
        return [] as { id: string; email: string }[];
      }
      return (data ?? []) as { id: string; email: string }[];
    },
  });

  const {
    data: customers = [],
    isLoading,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-customers', isAdmin],
    enabled: !permissionsLoading,
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          user_addresses (*),
          orders (id, order_number, order_type, total, subtotal, delivery_fee, tax, status, created_at)
        `);

      if (profilesError) throw profilesError;
      return profilesData ?? [];
    },
  });

  const { data: reservations } = useQuery({
    queryKey: ['admin-all-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_reservations')
        .select('*, branches(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });


  // ─── Wallet mutation ───
  const walletMutation = useMutation({
    mutationFn: async ({ userId, amount, action }: { userId: string; amount: number; action: 'add' | 'remove' }) => {
      const currentProfile = customers?.find(c => c.id === userId);
      const currentBalance = Number((currentProfile as any)?.cashback_balance) || 0;
      const newBalance = action === 'add'
        ? currentBalance + amount
        : Math.max(0, currentBalance - amount);

      const { error } = await supabase
        .from('profiles')
        .update({ cashback_balance: newBalance } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setWalletDialogOpen(false);
      setWalletAmount('');
      setWalletReason('');
      toast({ title: 'Wallet updated', description: `Points ${walletAction === 'add' ? 'added' : 'removed'} successfully` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update wallet', description: err.message, variant: 'destructive' });
    },
  });

  // ─── Helpers ───
  const getEmail = (id: string) => customerEmails.find(e => e.id === id)?.email || 'N/A';
  const getOrderStats = (orders: any[]) => {
    if (!orders?.length) return { total: 0, count: 0 };
    return { total: orders.reduce((s, o) => s + Number(o.total), 0), count: orders.length };
  };

  const filteredCustomers = useMemo(() => {
    if (!customers.length) return [];
    const q = searchQuery.toLowerCase();
    return customers.filter(c => {
      const email = getEmail(c.id);
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery, customerEmails]);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const selectedEmail = selectedCustomerId ? getEmail(selectedCustomerId) : '';
  const selectedOrders = selectedCustomer?.orders || [];
  const selectedReservations = reservations?.filter(r => r.user_id === selectedCustomerId) || [];
  const selectedAddresses = selectedCustomer?.user_addresses || [];
  const selectedStats = getOrderStats(selectedOrders);
  
  const selectedCashback = Number((selectedCustomer as any)?.cashback_balance) || 0;

  // ─── Detail View ───
  if (selectedCustomerId && selectedCustomer) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCustomerId(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{selectedCustomer.full_name || 'Anonymous'}</h1>
              <p className="text-sm text-muted-foreground truncate">{selectedEmail}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{selectedStats.count}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{formatCurrency(selectedStats.total)}</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CalendarDays className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{selectedReservations.length}</p>
                <p className="text-xs text-muted-foreground">Reservations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Wallet className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                <p className="text-2xl font-bold">{formatCurrency(selectedCashback)}</p>
                <p className="text-xs text-muted-foreground">Wallet Balance</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full overflow-x-auto gap-1 flex-nowrap">
              <TabsTrigger value="info" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><Info className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Info</span></TabsTrigger>
              <TabsTrigger value="orders" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><ShoppingBag className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Orders</span></TabsTrigger>
              <TabsTrigger value="reservations" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><CalendarDays className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Bookings</span></TabsTrigger>
              <TabsTrigger value="addresses" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><MapPin className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Addresses</span></TabsTrigger>
              <TabsTrigger value="wallet" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><Wallet className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Wallet</span></TabsTrigger>
              <TabsTrigger value="reports" className="flex-1 min-w-0 text-xs sm:text-sm px-2 sm:px-4"><BarChart3 className="w-3.5 h-3.5 mr-1 sm:mr-2 flex-shrink-0" /><span className="truncate">Reports</span></TabsTrigger>
            </TabsList>

            {/* ── Info Tab ── */}
            <TabsContent value="info">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {(selectedCustomer as any).avatar_url ? (
                        <img src={(selectedCustomer as any).avatar_url} className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="w-10 h-10 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCustomer.full_name || 'Anonymous'}</h3>
                      <p className="text-sm text-muted-foreground">Customer since {new Date(selectedCustomer.created_at || '').toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{selectedEmail}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{selectedCustomer.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{selectedAddresses.length} saved address{selectedAddresses.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Wallet className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span>Wallet: {formatCurrency(selectedCashback)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Orders Tab ── */}
            <TabsContent value="orders">
              <Card>
                <CardContent className="p-4">
                  {selectedOrders.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No orders yet</p>
                  ) : (
                    <div className="space-y-3">
                      {[...selectedOrders].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{order.order_number}</span>
                              <Badge variant="outline" className={`text-xs capitalize ${orderStatusColor(order.status)}`}>
                                {order.status?.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.created_at).toLocaleDateString()} • {order.order_type}
                            </p>
                          </div>
                          <span className="font-semibold text-sm">{formatCurrency(Number(order.total))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Reservations Tab ── */}
            <TabsContent value="reservations">
              <Card>
                <CardContent className="p-4">
                  {selectedReservations.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No reservations yet</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedReservations.map((res: any) => (
                        <div key={res.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{(res.branches as any)?.name || 'Branch'}</span>
                              <Badge variant="outline" className={`text-xs capitalize ${reservationStatusColor(res.status)}`}>
                                {res.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {res.reservation_date} • {res.start_time?.slice(0, 5)} – {res.end_time?.slice(0, 5)} • {res.party_size} guests
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Addresses Tab ── */}
            <TabsContent value="addresses">
              <Card>
                <CardContent className="p-4">
                  {selectedAddresses.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No addresses saved</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedAddresses.map((addr: any) => (
                        <div key={addr.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                          <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{addr.label}</span>
                              {addr.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {addr.address_line1}{addr.address_line2 && `, ${addr.address_line2}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{addr.city}{addr.postal_code && `, ${addr.postal_code}`}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Wallet Tab ── */}
            <TabsContent value="wallet">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-amber-500" />
                        Sashiko Wallet
                      </CardTitle>
                      <CardDescription>Balance: {formatCurrency(selectedCashback)}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setWalletAction('add'); setWalletDialogOpen(true); }}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setWalletAction('remove'); setWalletDialogOpen(true); }}>
                        <Minus className="w-3.5 h-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-center py-6 text-muted-foreground text-sm">
                    Cashback is earned automatically on delivered orders.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Reports Tab ── */}
            <TabsContent value="reports">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Customer Report</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                      <p className="text-xl font-bold">{selectedStats.count}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedStats.total)}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Average Order Value</p>
                      <p className="text-xl font-bold">{selectedStats.count > 0 ? formatCurrency(selectedStats.total / selectedStats.count) : formatCurrency(0)}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Total Reservations</p>
                      <p className="text-xl font-bold">{selectedReservations.length}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Delivery Orders</p>
                      <p className="text-xl font-bold">{selectedOrders.filter((o: any) => o.order_type === 'delivery').length}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Pickup Orders</p>
                      <p className="text-xl font-bold">{selectedOrders.filter((o: any) => o.order_type === 'pickup').length}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Cancelled Orders</p>
                      <p className="text-xl font-bold text-destructive">{selectedOrders.filter((o: any) => o.status === 'cancelled').length}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <p className="text-xs text-muted-foreground">Last Order</p>
                      <p className="text-xl font-bold">
                        {selectedOrders.length > 0
                          ? new Date(
                              [...selectedOrders].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
                            ).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Wallet Dialog */}
        <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{walletAction === 'add' ? 'Add' : 'Remove'} Wallet Points</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10.00"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  placeholder="e.g. Loyalty bonus"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setWalletDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={!walletAmount || parseFloat(walletAmount) <= 0 || walletMutation.isPending}
                onClick={() => {
                  if (!selectedCustomerId) return;
                  walletMutation.mutate({
                    userId: selectedCustomerId,
                    amount: parseFloat(walletAmount),
                    action: walletAction,
                  });
                }}
              >
                {walletMutation.isPending ? 'Saving...' : walletAction === 'add' ? 'Add Points' : 'Remove Points'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // ─── List View ───
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <UserCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
            Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage customer information</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading customers...</div>
        ) : customersError ? (
          <div className="text-center py-12 text-destructive">
            Failed to load customers: {(customersError as Error).message}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No customers found</div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => {
              const stats = getOrderStats(customer.orders);
              const email = getEmail(customer.id);
              const cashback = Number((customer as any).cashback_balance) || 0;
              return (
                <Card
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {(customer as any).avatar_url ? (
                        <img src={(customer as any).avatar_url} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{customer.full_name || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground truncate">{email}</p>
                      {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(stats.total)}</p>
                      <p className="text-xs text-muted-foreground">{stats.count} orders</p>
                      {cashback > 0 && (
                        <p className="text-xs text-amber-500 font-medium">{formatCurrency(cashback)} wallet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
