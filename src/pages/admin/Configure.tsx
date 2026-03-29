import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, DollarSign, Globe, Settings, Coins, Timer, ToggleLeft, Truck, Banknote, CalendarDays, HandCoins, FileText, ShieldCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Configure = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Payment & VAT settings state
  const [vatRate, setVatRate] = useState<string>('0');
  const [vatNumber, setVatNumber] = useState<string>('');
  const [cashbackRate, setCashbackRate] = useState<string>('0');
  
  // Regional settings state
  const [currency, setCurrency] = useState<string>('USD');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [language, setLanguage] = useState<string>('en');

  // Order automation settings
  const [autoPrepareEnabled, setAutoPrepareEnabled] = useState(true);
  const [autoPreparePercent, setAutoPreparePercent] = useState(50);
  const [autoReadyEnabled, setAutoReadyEnabled] = useState(true);
  const [scheduledAlertMinutes, setScheduledAlertMinutes] = useState<string>('30');
  const [allowCustomerCancel, setAllowCustomerCancel] = useState(false);
  const [scheduleMinDays, setScheduleMinDays] = useState<string>('0');
  const [scheduleMaxDays, setScheduleMaxDays] = useState<string>('7');

  // Delivery fee settings
  const [deliveryBaseFee, setDeliveryBaseFee] = useState<string>('2.00');
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState<string>('0.50');
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<string>('');
  const [maxDeliveryFee, setMaxDeliveryFee] = useState<string>('');
  const [minDeliveryFee, setMinDeliveryFee] = useState<string>('0');

  // Service fee settings
  const [serviceFeeRate, setServiceFeeRate] = useState<string>('5');

  // Reservation settings
  const [reservationDuration, setReservationDuration] = useState<string>('120');
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationValue, setCustomDurationValue] = useState<string>('120');

  // Cash payment settings
  const [cashBranches, setCashBranches] = useState<Array<{ id: string; name: string; allow_cash_pickup: boolean; allow_cash_delivery: boolean }>>([]);
  const [selectedCashBranchId, setSelectedCashBranchId] = useState<string>('');
  const [allowCashPickup, setAllowCashPickup] = useState(true);
  const [allowCashDelivery, setAllowCashDelivery] = useState(true);

  // Legal content state
  const [termsOfService, setTermsOfService] = useState<string>('');
  const [privacyPolicy, setPrivacyPolicy] = useState<string>('');



  // Load tenant settings
  const { data: tenantSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Initialize state with loaded data
      if (data) {
        setVatRate(data.vat_rate?.toString() || '0');
        setVatNumber(data.vat_number || '');
        setCashbackRate((data as any).cashback_rate?.toString() || '0');
        setCurrency(data.currency || 'USD');
        setTimezone(data.timezone || 'UTC');
        setLanguage(data.language || 'en');
        setAutoPrepareEnabled((data as any).auto_prepare_enabled ?? true);
        setAutoPreparePercent((data as any).auto_prepare_percent ?? 50);
        setAutoReadyEnabled((data as any).auto_ready_enabled ?? true);
        setScheduledAlertMinutes(((data as any).scheduled_alert_minutes ?? 30).toString());
        setAllowCustomerCancel((data as any).allow_customer_cancel ?? false);
        setScheduleMinDays(((data as any).schedule_min_days ?? 0).toString());
        setScheduleMaxDays(((data as any).schedule_max_days ?? 7).toString());
        setDeliveryBaseFee(((data as any).delivery_base_fee ?? 2).toString());
        setDeliveryFeePerKm(((data as any).delivery_fee_per_km ?? 0.5).toString());
        setFreeDeliveryThreshold((data as any).free_delivery_threshold != null ? (data as any).free_delivery_threshold.toString() : '');
        setMaxDeliveryFee((data as any).max_delivery_fee != null ? (data as any).max_delivery_fee.toString() : '');
        setMinDeliveryFee(((data as any).min_delivery_fee ?? 0).toString());
        setServiceFeeRate(((data as any).service_fee_rate ?? 5).toString());
        const duration = ((data as any).reservation_duration_minutes ?? 120).toString();
        const presetValues = ['30', '45', '60', '90', '120', '150', '180', '240'];
        if (presetValues.includes(duration)) {
          setReservationDuration(duration);
          setIsCustomDuration(false);
        } else {
          setReservationDuration('custom');
          setIsCustomDuration(true);
          setCustomDurationValue(duration);
        }
        setTermsOfService((data as any)?.terms_of_service || '');
        setPrivacyPolicy((data as any)?.privacy_policy || '');
      }
      
      return data;
    },
  });

  // Load branches for cash payment settings
  const { data: branchesData } = useQuery({
    queryKey: ['branches-cash-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, allow_cash_pickup, allow_cash_delivery')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; allow_cash_pickup: boolean; allow_cash_delivery: boolean }>;
    },
  });

  // When branches load, set state
  useEffect(() => {
    if (branchesData && branchesData.length > 0) {
      setCashBranches(branchesData);
      if (!selectedCashBranchId) {
        setSelectedCashBranchId(branchesData[0].id);
        setAllowCashPickup((branchesData[0] as any).allow_cash_pickup ?? true);
        setAllowCashDelivery((branchesData[0] as any).allow_cash_delivery ?? true);
      }
    }
  }, [branchesData]);

  // When selected branch changes, update toggles
  useEffect(() => {
    if (selectedCashBranchId && cashBranches.length > 0) {
      const b = cashBranches.find(br => br.id === selectedCashBranchId);
      if (b) {
        setAllowCashPickup(b.allow_cash_pickup);
        setAllowCashDelivery(b.allow_cash_delivery);
      }
    }
  }, [selectedCashBranchId, cashBranches]);
  // --- Unsaved changes tracking ---
  const initialValuesRef = useRef<string | null>(null);
  
  // Build a snapshot string of all current settings values
  const currentSnapshot = useMemo(() => JSON.stringify({
    vatRate, vatNumber, cashbackRate, currency, timezone, language,
    autoPrepareEnabled, autoPreparePercent, autoReadyEnabled,
    scheduledAlertMinutes, allowCustomerCancel, scheduleMinDays, scheduleMaxDays,
    deliveryBaseFee, deliveryFeePerKm, freeDeliveryThreshold, maxDeliveryFee, minDeliveryFee,
    serviceFeeRate,
    reservationDuration, isCustomDuration, customDurationValue,
  }), [
    vatRate, vatNumber, cashbackRate, currency, timezone, language,
    autoPrepareEnabled, autoPreparePercent, autoReadyEnabled,
    scheduledAlertMinutes, allowCustomerCancel, scheduleMinDays, scheduleMaxDays,
    deliveryBaseFee, deliveryFeePerKm, freeDeliveryThreshold, maxDeliveryFee, minDeliveryFee,
    serviceFeeRate,
    reservationDuration, isCustomDuration, customDurationValue,
  ]);

  // Snapshot initial values once settings are loaded
  useEffect(() => {
    if (!isLoadingSettings && tenantSettings && initialValuesRef.current === null) {
      // Use a small delay to let all setState calls settle
      const timer = setTimeout(() => {
        initialValuesRef.current = currentSnapshot;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingSettings, tenantSettings, currentSnapshot]);

  const isDirty = initialValuesRef.current !== null && currentSnapshot !== initialValuesRef.current;

  const { showDialog, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);

  // Reset dirty state after any successful save
  const markClean = useCallback(() => {
    initialValuesRef.current = currentSnapshot;
  }, [currentSnapshot]);


  const saveCashSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCashBranchId) throw new Error('No branch selected');
      const { error } = await supabase
        .from('branches')
        .update({
          allow_cash_pickup: allowCashPickup,
          allow_cash_delivery: allowCashDelivery,
        } as any)
        .eq('id', selectedCashBranchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches-cash-settings'] });
      toast({
        title: 'Cash payment settings saved',
        description: 'Cash availability has been updated for this branch'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save cash settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });


  // Save payment settings mutation
  const savePaymentSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          vat_rate: parseFloat(vatRate) || 0,
          vat_number: vatNumber || null,
          cashback_rate: parseFloat(cashbackRate) || 0,
        } as any)
        .eq('id', tenantSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({ 
        title: 'Payment settings saved',
        description: 'VAT and tax settings have been updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save payment settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save regional settings mutation
  const saveRegionalSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          currency,
          timezone,
          language,
        })
        .eq('id', tenantSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({ 
        title: 'Regional settings saved',
        description: 'Currency, timezone, and language settings have been updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save regional settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save reservation settings mutation
  const saveReservationSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          reservation_duration_minutes: parseInt(isCustomDuration ? customDurationValue : reservationDuration) || 120,
        } as any)
        .eq('id', tenantSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({ 
        title: 'Reservation settings saved',
        description: 'Default reservation duration has been updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save reservation settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save order automation settings mutation
  const saveAutomationMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          auto_prepare_enabled: autoPrepareEnabled,
          auto_prepare_percent: autoPreparePercent,
          auto_ready_enabled: autoReadyEnabled,
          scheduled_alert_minutes: parseInt(scheduledAlertMinutes) || 30,
          allow_customer_cancel: allowCustomerCancel,
          schedule_min_days: parseInt(scheduleMinDays) || 0,
          schedule_max_days: parseInt(scheduleMaxDays) || 7,
        } as any)
        .eq('id', tenantSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({ 
        title: 'Order automation saved',
        description: 'Auto-progression settings have been updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save automation settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save delivery fee settings mutation
  const saveDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          delivery_base_fee: parseFloat(deliveryBaseFee) || 0,
          delivery_fee_per_km: parseFloat(deliveryFeePerKm) || 0,
          free_delivery_threshold: freeDeliveryThreshold ? parseFloat(freeDeliveryThreshold) : null,
          max_delivery_fee: maxDeliveryFee ? parseFloat(maxDeliveryFee) : null,
          min_delivery_fee: parseFloat(minDeliveryFee) || 0,
        } as any)
        .eq('id', tenantSettings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({ 
        title: 'Delivery fee settings saved',
        description: 'Delivery fee formula has been updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save delivery settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  // Save service fee settings mutation
  const saveServiceFeeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({
          service_fee_rate: parseFloat(serviceFeeRate) || 0,
        } as any)
        .eq('id', tenantSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      markClean();
      toast({
        title: 'Service fee settings saved',
        description: 'Service fee rate has been updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save service fee settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save terms of service mutation
  const saveTermsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ terms_of_service: termsOfService || null } as any)
        .eq('id', tenantSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['legal-content'] });
      toast({ title: 'Terms of Service saved', description: 'Content has been updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  // Save privacy policy mutation
  const savePrivacyMutation = useMutation({
    mutationFn: async () => {
      if (!tenantSettings?.id) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ privacy_policy: privacyPolicy || null } as any)
        .eq('id', tenantSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['legal-content'] });
      toast({ title: 'Privacy Policy saved', description: 'Content has been updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <>
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
              <span className="break-words">Configuration</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Manage system settings and integrations
            </p>
          </div>
        </div>

        <Tabs defaultValue="payment" className="w-full">
          <TabsList className="w-full sm:w-auto overflow-x-auto gap-1">
            <TabsTrigger value="payment" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <DollarSign className="w-4 h-4 mr-2" />
              Payment & VAT
            </TabsTrigger>
            <TabsTrigger value="regional" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <Globe className="w-4 h-4 mr-2" />
              Regional
            </TabsTrigger>
            <TabsTrigger value="automation" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <Timer className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="delivery" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <Truck className="w-4 h-4 mr-2" />
              Delivery Fees
            </TabsTrigger>
            <TabsTrigger value="service-fee" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <HandCoins className="w-4 h-4 mr-2" />
              Service Fee
            </TabsTrigger>
            <TabsTrigger value="reservations" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <Settings className="w-4 h-4 mr-2" />
              Reservations
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <FileText className="w-4 h-4 mr-2" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-sm px-4 py-2 flex-1 sm:flex-initial">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>


          <TabsContent value="payment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Payment & VAT Settings
                </CardTitle>
                <CardDescription>
                  Configure tax rates and payment settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vat-rate">VAT/Tax Rate (%)</Label>
                  <Input
                    id="vat-rate"
                    type="number"
                    placeholder="e.g., 20"
                    min="0"
                    max="100"
                    step="0.01"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    disabled={isLoadingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default tax rate applied to orders
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat-number">VAT Registration Number</Label>
                  <Input
                    id="vat-number"
                    placeholder="e.g., GB123456789"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    disabled={isLoadingSettings}
                  />
                </div>
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="cashback-rate" className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Cashback Rate (%)
                  </Label>
                  <Input
                    id="cashback-rate"
                    type="number"
                    placeholder="e.g., 5"
                    min="0"
                    max="100"
                    step="0.1"
                    value={cashbackRate}
                    onChange={(e) => setCashbackRate(e.target.value)}
                    disabled={isLoadingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of order total returned as cashback to customers (e.g., 5 = 5% cashback)
                  </p>
                </div>
                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => savePaymentSettingsMutation.mutate()}
                  disabled={savePaymentSettingsMutation.isPending || isLoadingSettings}
                >
                  {savePaymentSettingsMutation.isPending ? 'Saving...' : 'Save Payment Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regional" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Regional Settings
                </CardTitle>
                <CardDescription>
                  Configure currency, timezone, and language preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={currency} 
                    onValueChange={setCurrency}
                    disabled={isLoadingSettings}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                      <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="QAR">QAR - Qatari Riyal</SelectItem>
                      <SelectItem value="KWD">KWD - Kuwaiti Dinar</SelectItem>
                      <SelectItem value="BHD">BHD - Bahraini Dinar</SelectItem>
                      <SelectItem value="OMR">OMR - Omani Rial</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                      <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                      <SelectItem value="SEK">SEK - Swedish Krona (kr)</SelectItem>
                      <SelectItem value="NOK">NOK - Norwegian Krone (kr)</SelectItem>
                      <SelectItem value="DKK">DKK - Danish Krone (kr)</SelectItem>
                      <SelectItem value="TRY">TRY - Turkish Lira (₺)</SelectItem>
                      <SelectItem value="ZAR">ZAR - South African Rand (R)</SelectItem>
                      <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
                      <SelectItem value="MXN">MXN - Mexican Peso ($)</SelectItem>
                      <SelectItem value="SGD">SGD - Singapore Dollar (S$)</SelectItem>
                      <SelectItem value="HKD">HKD - Hong Kong Dollar (HK$)</SelectItem>
                      <SelectItem value="NZD">NZD - New Zealand Dollar (NZ$)</SelectItem>
                      <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                      <SelectItem value="KRW">KRW - Korean Won (₩)</SelectItem>
                      <SelectItem value="PLN">PLN - Polish Zloty (zł)</SelectItem>
                      <SelectItem value="CZK">CZK - Czech Koruna (Kč)</SelectItem>
                      <SelectItem value="HUF">HUF - Hungarian Forint (Ft)</SelectItem>
                      <SelectItem value="THB">THB - Thai Baht (฿)</SelectItem>
                      <SelectItem value="MYR">MYR - Malaysian Ringgit (RM)</SelectItem>
                      <SelectItem value="PHP">PHP - Philippine Peso (₱)</SelectItem>
                      <SelectItem value="IDR">IDR - Indonesian Rupiah (Rp)</SelectItem>
                      <SelectItem value="EGP">EGP - Egyptian Pound (E£)</SelectItem>
                      <SelectItem value="NGN">NGN - Nigerian Naira (₦)</SelectItem>
                      <SelectItem value="KES">KES - Kenyan Shilling (KSh)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select 
                    value={timezone} 
                    onValueChange={setTimezone}
                    disabled={isLoadingSettings}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (GMT-5)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (GMT-6)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (GMT-8)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (GMT+1)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (GMT+9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Default Language</Label>
                  <Select 
                    value={language} 
                    onValueChange={setLanguage}
                    disabled={isLoadingSettings}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => saveRegionalSettingsMutation.mutate()}
                  disabled={saveRegionalSettingsMutation.isPending || isLoadingSettings}
                >
                  {saveRegionalSettingsMutation.isPending ? 'Saving...' : 'Save Regional Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Order Status Auto-Progression
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure how orders automatically move through statuses based on the preparation time estimate set by staff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Preparing */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Auto-move to "Preparing"</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically transition orders from <strong>Confirmed</strong> → <strong>Preparing</strong> after a percentage of the estimated prep time has elapsed.
                      </p>
                    </div>
                    <Switch
                      checked={autoPrepareEnabled}
                      onCheckedChange={setAutoPrepareEnabled}
                      disabled={isLoadingSettings}
                    />
                  </div>

                  {autoPrepareEnabled && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Trigger after</Label>
                        <span className="text-sm font-semibold text-primary">{autoPreparePercent}% of estimated time</span>
                      </div>
                      <Slider
                        value={[autoPreparePercent]}
                        onValueChange={([val]) => setAutoPreparePercent(val)}
                        min={10}
                        max={90}
                        step={5}
                        disabled={isLoadingSettings}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>10% (early)</span>
                        <span>90% (late)</span>
                      </div>
                      <div className="text-xs text-muted-foreground bg-card p-3 rounded-md border border-border">
                        <strong>Example:</strong> If staff estimates 20 min prep time and this is set to {autoPreparePercent}%, the order will auto-move to "Preparing" after <strong>{Math.round(20 * autoPreparePercent / 100)} minutes</strong>.
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto Ready */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Auto-move to "Ready"</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically transition orders to <strong>Ready</strong> when the full estimated preparation time has elapsed.
                      </p>
                    </div>
                    <Switch
                      checked={autoReadyEnabled}
                      onCheckedChange={setAutoReadyEnabled}
                      disabled={isLoadingSettings}
                    />
                  </div>
                  {autoReadyEnabled && (
                    <div className="text-xs text-muted-foreground bg-card p-3 rounded-md border border-border">
                      <strong>How it works:</strong> When the staff-estimated preparation time is reached (100%), the order will auto-move from Confirmed/Preparing → Ready.
                    </div>
                  )}
                </div>

                {/* Scheduled Order Alert */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Timer className="w-4 h-4 text-primary" />
                      Scheduled Order Alert
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When a scheduled order arrives while the branch is closed, show the staff notification this many minutes <strong>before</strong> the branch opens.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['15', '30', '45', '60'].map((mins) => (
                      <Button key={mins} variant={scheduledAlertMinutes === mins ? 'default' : 'outline'} size="sm" onClick={() => setScheduledAlertMinutes(mins)}>
                        {mins} min
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Custom:</span>
                    <Input type="number" min="5" max="180" value={scheduledAlertMinutes} onChange={(e) => setScheduledAlertMinutes(e.target.value)} className="w-24" />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                  <div className="text-xs text-muted-foreground bg-card p-3 rounded-md border border-border">
                    <strong>Example:</strong> If your branch opens at 10:00 and this is set to {scheduledAlertMinutes} min, staff will see the scheduled order popup at <strong>{(() => {
                      const mins = parseInt(scheduledAlertMinutes) || 30;
                      const h = Math.floor((600 - mins) / 60);
                      const m = (600 - mins) % 60;
                      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    })()}</strong>.
                  </div>
                </div>

                {/* Scheduling Window */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      Schedule for Later — Date Range
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Control how far in the future customers can schedule orders. "Min days" sets the earliest day (0 = today), "Max days" sets the latest.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Minimum days from today</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={scheduleMinDays}
                        onChange={(e) => setScheduleMinDays(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Maximum days from today</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={scheduleMaxDays}
                        onChange={(e) => setScheduleMaxDays(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-card p-3 rounded-md border border-border">
                    <strong>Current setting:</strong> Customers can schedule orders from <strong>{scheduleMinDays === '0' ? 'today' : `${scheduleMinDays} day${scheduleMinDays === '1' ? '' : 's'} from now`}</strong> up to <strong>{scheduleMaxDays} day{scheduleMaxDays === '1' ? '' : 's'}</strong> in advance.
                  </div>
                </div>

                {/* Customer Cancel */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Allow customers to cancel before confirmation</Label>
                      <p className="text-xs text-muted-foreground">
                        Shows a Cancel Order button on the order page. Customers can only cancel while the order is awaiting confirmation.
                      </p>
                    </div>
                    <Switch
                      checked={allowCustomerCancel}
                      onCheckedChange={setAllowCustomerCancel}
                      disabled={isLoadingSettings}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => saveAutomationMutation.mutate()}
                  disabled={saveAutomationMutation.isPending || isLoadingSettings}
                >
                  {saveAutomationMutation.isPending ? 'Saving...' : 'Save Order Settings'}
                </Button>
              </CardContent>
            </Card>

            {/* Cash Payment Availability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Cash Payment Availability
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Control whether cash payments are available per branch and order type.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Branch Selector */}
                <div className="space-y-2">
                  <Label>Select Branch</Label>
                  <Select
                    value={selectedCashBranchId}
                    onValueChange={setSelectedCashBranchId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBranches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCashBranchId && (
                  <>
                    {/* Cash for Pickup */}
                    <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Allow cash for pickup orders</Label>
                          <p className="text-xs text-muted-foreground">
                            Show Cash as a payment option when customers place pickup orders for this branch.
                          </p>
                        </div>
                        <Switch
                          checked={allowCashPickup}
                          onCheckedChange={setAllowCashPickup}
                        />
                      </div>
                    </div>

                    {/* Cash for Delivery */}
                    <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Allow cash for delivery orders</Label>
                          <p className="text-xs text-muted-foreground">
                            Show Cash as a payment option when customers place delivery orders for this branch.
                          </p>
                        </div>
                        <Switch
                          checked={allowCashDelivery}
                          onCheckedChange={setAllowCashDelivery}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => saveCashSettingsMutation.mutate()}
                      disabled={saveCashSettingsMutation.isPending}
                    >
                      {saveCashSettingsMutation.isPending ? 'Saving...' : 'Save Cash Settings'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Delivery Fee Formula
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure how delivery fees are calculated. Formula: <strong>Base Fee + (Distance × Per-km Rate)</strong>, clamped between min and max.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery-base-fee">Base Delivery Fee</Label>
                    <Input
                      id="delivery-base-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryBaseFee}
                      onChange={(e) => setDeliveryBaseFee(e.target.value)}
                      disabled={isLoadingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fixed fee charged regardless of distance
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery-fee-per-km">Fee Per Kilometer</Label>
                    <Input
                      id="delivery-fee-per-km"
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryFeePerKm}
                      onChange={(e) => setDeliveryFeePerKm(e.target.value)}
                      disabled={isLoadingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Additional fee per km of delivery distance
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-delivery-fee">Minimum Delivery Fee</Label>
                    <Input
                      id="min-delivery-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={minDeliveryFee}
                      onChange={(e) => setMinDeliveryFee(e.target.value)}
                      disabled={isLoadingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fee will never go below this amount
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-delivery-fee">Maximum Delivery Fee</Label>
                    <Input
                      id="max-delivery-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={maxDeliveryFee}
                      onChange={(e) => setMaxDeliveryFee(e.target.value)}
                      placeholder="No limit"
                      disabled={isLoadingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cap the delivery fee (leave empty for no max)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="free-delivery-threshold">Free Delivery Threshold</Label>
                  <Input
                    id="free-delivery-threshold"
                    type="number"
                    min="0"
                    step="0.01"
                    value={freeDeliveryThreshold}
                    onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                    placeholder="Disabled"
                    disabled={isLoadingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orders above this subtotal get free delivery (leave empty to disable)
                  </p>
                </div>

                {/* Live preview */}
                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <h4 className="text-sm font-medium">Formula Preview</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[2, 5, 8, 12].map((km) => {
                      const base = parseFloat(deliveryBaseFee) || 0;
                      const perKm = parseFloat(deliveryFeePerKm) || 0;
                      const min = parseFloat(minDeliveryFee) || 0;
                      const max = maxDeliveryFee ? parseFloat(maxDeliveryFee) : null;
                      let fee = base + km * perKm;
                      fee = Math.max(fee, min);
                      if (max != null) fee = Math.min(fee, max);
                      fee = Math.round(fee * 100) / 100;
                      return (
                        <div key={km} className="p-3 rounded-md bg-card border border-border">
                          <p className="text-xs text-muted-foreground">{km} km</p>
                          <p className="text-lg font-bold text-primary">{fee.toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {freeDeliveryThreshold && (
                    <p className="text-xs text-muted-foreground text-center">
                      🎉 Orders above {parseFloat(freeDeliveryThreshold).toFixed(2)} get <strong>free delivery</strong>
                    </p>
                  )}
                </div>

                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => saveDeliveryMutation.mutate()}
                  disabled={saveDeliveryMutation.isPending || isLoadingSettings}
                >
                  {saveDeliveryMutation.isPending ? 'Saving...' : 'Save Delivery Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service-fee" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <HandCoins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Service Fee
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure the service fee percentage applied to all orders. This fee is calculated as a percentage of the order subtotal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="service-fee-rate">Service Fee Rate (%)</Label>
                  <Input
                    id="service-fee-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={serviceFeeRate}
                    onChange={(e) => setServiceFeeRate(e.target.value)}
                    disabled={isLoadingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of order subtotal charged as a service fee (e.g., 5 = 5%)
                  </p>
                </div>

                {/* Live preview */}
                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <h4 className="text-sm font-medium">Fee Preview</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[10, 25, 50, 100].map((orderAmount) => {
                      const rate = parseFloat(serviceFeeRate) || 0;
                      const fee = Math.round(orderAmount * rate) / 100;
                      return (
                        <div key={orderAmount} className="p-3 rounded-md bg-card border border-border">
                          <p className="text-xs text-muted-foreground">Order: {orderAmount}</p>
                          <p className="text-lg font-bold text-primary">{fee.toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {parseFloat(serviceFeeRate) === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Service fee is disabled (0%)
                    </p>
                  )}
                </div>

                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => saveServiceFeeMutation.mutate()}
                  disabled={saveServiceFeeMutation.isPending || isLoadingSettings}
                >
                  {saveServiceFeeMutation.isPending ? 'Saving...' : 'Save Service Fee Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Reservation Settings
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure default settings for table reservations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Timer className="w-4 h-4 text-primary" />
                      Default Reservation Duration (minutes)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      How long each table reservation lasts. This determines the end time calculated from the start time.
                    </p>
                    <Select
                      value={reservationDuration}
                      onValueChange={(val) => {
                        setReservationDuration(val);
                        if (val === 'custom') {
                          setIsCustomDuration(true);
                        } else {
                          setIsCustomDuration(false);
                        }
                      }}
                      disabled={isLoadingSettings}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="150">2.5 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCustomDuration && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="5"
                          max="720"
                          value={customDurationValue}
                          onChange={(e) => setCustomDurationValue(e.target.value)}
                          placeholder="Enter minutes"
                          className="w-40"
                        />
                        <span className="text-sm text-muted-foreground">minutes</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground bg-card p-3 rounded-md border border-border">
                      <strong>Example:</strong> If a guest books at 19:00 with a {(() => {
                        const mins = parseInt(isCustomDuration ? customDurationValue : reservationDuration) || 120;
                        return mins;
                      })()}-minute duration, the table will be reserved until <strong>{(() => {
                        const mins = parseInt(isCustomDuration ? customDurationValue : reservationDuration) || 120;
                        const d = new Date(2000, 0, 1, 19, 0);
                        d.setMinutes(d.getMinutes() + mins);
                        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      })()}</strong>.
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => saveReservationSettingsMutation.mutate()}
                  disabled={saveReservationSettingsMutation.isPending || isLoadingSettings}
                >
                  {saveReservationSettingsMutation.isPending ? 'Saving...' : 'Save Reservation Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Terms of Service
                </CardTitle>
                <CardDescription>
                  Write and manage your Terms of Service content. This will be shown to customers on the login and profile pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RichTextEditor
                  value={termsOfService}
                  onChange={setTermsOfService}
                  placeholder="Enter your Terms of Service content here..."
                  minHeight="300px"
                />
                <Button
                  onClick={() => saveTermsMutation.mutate()}
                  disabled={saveTermsMutation.isPending || isLoadingSettings}
                >
                  {saveTermsMutation.isPending ? 'Saving...' : 'Save Terms of Service'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Privacy Policy
                </CardTitle>
                <CardDescription>
                  Write and manage your Privacy Policy content. This will be shown to customers on the login and profile pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RichTextEditor
                  value={privacyPolicy}
                  onChange={setPrivacyPolicy}
                  placeholder="Enter your Privacy Policy content here..."
                  minHeight="300px"
                />
                <Button
                  onClick={() => savePrivacyMutation.mutate()}
                  disabled={savePrivacyMutation.isPending || isLoadingSettings}
                >
                  {savePrivacyMutation.isPending ? 'Saving...' : 'Save Privacy Policy'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>

    <Dialog open={showDialog} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave now, your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={confirmLeave}>
            Discard Changes
          </Button>
          <Button onClick={cancelLeave} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Keep Editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Configure;
