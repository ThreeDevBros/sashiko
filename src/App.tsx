import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useBranding } from "./hooks/useBranding";
import { useBranch } from "./hooks/useBranch";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PageTransitionProvider } from "./contexts/PageTransitionContext";
import { AnimatedPage } from "./components/AnimatedPage";
import LoadingScreen from "./components/LoadingScreen";
import { ScrollToTop } from "./components/ScrollToTop";
import { GlobalDriverTracker } from "./components/driver/GlobalDriverTracker";
import { PhonePromptDialog } from "./components/PhonePromptDialog";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleBasedRoute, isRouteAllowedForRoles } from "./hooks/useRoleRedirect";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { prefetchSavedCards } from './hooks/useSavedCards';
import Index from "./pages/Index";
import Order from "./pages/Order";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderHistory from "./pages/OrderHistory";
import ReservationHistory from "./pages/ReservationHistory";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import TableBooking from "./pages/TableBooking";
import Address from "./pages/Address";
import OrderTracking from "./pages/OrderTracking";
import DriverDashboard from "./pages/DriverDashboard";
import DriverOrders from "./pages/driver/DriverOrders";
import DriverActiveDelivery from "./pages/driver/DriverActiveDelivery";
import NotFound from "./pages/NotFound";
import LegalPage from "./pages/LegalPage";
import Dashboard from "./pages/admin/Dashboard";
import MenuManagement from "./pages/admin/MenuManagement";
import BranchManagement from "./pages/admin/BranchManagement";
import Customise from "./pages/admin/Customise";
import CouponManagement from "./pages/admin/CouponManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import UserManagement from "./pages/admin/UserManagement";
import CustomerManagement from "./pages/admin/CustomerManagement";
import ReservationManagement from "./pages/admin/ReservationManagement";
import Configure from "./pages/admin/Configure";
import StaffDashboard from "./pages/admin/StaffDashboard";
import Statistics from "./pages/admin/Statistics";
import Reports from "./pages/admin/Reports";
import SocialMediaManagement from "./pages/admin/SocialMediaManagement";
import QRCodeMenu from "./pages/admin/QRCodeMenu";
import BranchMenu from "./pages/BranchMenu";
import StaffOrders from "./pages/staff/StaffOrders";
import StaffReservations from "./pages/staff/StaffReservations";
import StaffOrderHistory from "./pages/staff/StaffOrderHistory";
import StaffReport from "./pages/staff/StaffReport";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      networkMode: 'always',
      refetchOnReconnect: 'always',
      staleTime: 2 * 60 * 1000,
    },
  },
});

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  usePushNotifications(navigate);

  // Handle deep links from Live Activity taps (sashiko://order-tracking/:id)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.getPlatform() === 'web') return;
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('appUrlOpen', (event: { url: string }) => {
          console.log('[DeepLink] URL opened:', event.url);
          const match = event.url.match(/sashiko:\/\/order-tracking\/([a-f0-9-]+)/i);
          if (match?.[1]) {
            navigate(`/order-tracking/${match[1]}`);
          }
        });
        cleanup = () => listener.remove();
      } catch (err) {
        console.log('[DeepLink] Not available:', err);
      }
    })();
    return () => cleanup?.();
  }, [navigate]);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStaffRoute = location.pathname.startsWith('/staff');
  const isDriverRoute = location.pathname.startsWith('/driver');
  const isAuthRoute = location.pathname === '/auth';
  const isQrMenuRoute = location.pathname.startsWith('/qr-menu');
  const showNav = !isAdminRoute && !isStaffRoute && !isDriverRoute && !isAuthRoute && !isQrMenuRoute;
  
  useEffect(() => {
    if (!isAuthReady) return;

    const checkRoleAccess = async () => {
      if (isAuthRoute || isQrMenuRoute) return;

      const isProtectedPanel = location.pathname.startsWith('/admin') ||
                               location.pathname.startsWith('/staff') ||
                               location.pathname.startsWith('/driver');

      if (!user) {
        if (isProtectedPanel) {
          navigate('/auth', { replace: true });
        }
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = roleData?.map(r => r.role) || [];
      
      if (!isRouteAllowedForRoles(location.pathname, roles)) {
        const correctRoute = getRoleBasedRoute(roles);
        navigate(correctRoute, { replace: true });
      }
    };
    
    checkRoleAccess();
  }, [location.pathname, navigate, isAuthRoute, isQrMenuRoute, isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady) return;
    const hasVisited = localStorage.getItem('hasVisited');
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
    
    const isProtectedRoute = location.pathname.startsWith('/order-tracking') || 
                              location.pathname.startsWith('/checkout');
    
    if (!hasVisited && !hasCompletedOnboarding && location.pathname === '/' && !isProtectedRoute) {
      localStorage.setItem('hasVisited', 'true');
      navigate('/auth');
    }
  }, [location.pathname, navigate, isAuthReady]);
  
  return (
    <>
      <div className="flex w-full min-h-screen">
        <div className="flex-1 w-full" style={{ overflowX: 'clip' }}>
          
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<AnimatedPage><Index /></AnimatedPage>} />
              <Route path="/order" element={<AnimatedPage><Order /></AnimatedPage>} />
              <Route path="/cart" element={<AnimatedPage><Cart /></AnimatedPage>} />
              <Route path="/checkout" element={<AnimatedPage><Checkout /></AnimatedPage>} />
              <Route path="/order-history" element={<AnimatedPage><OrderHistory /></AnimatedPage>} />
              <Route path="/reservation-history" element={<AnimatedPage><ReservationHistory /></AnimatedPage>} />
              <Route path="/book-table" element={<AnimatedPage><TableBooking /></AnimatedPage>} />
              <Route path="/auth" element={<AnimatedPage><Auth /></AnimatedPage>} />
              <Route path="/profile" element={<AnimatedPage><Profile /></AnimatedPage>} />
              <Route path="/profile/address" element={<AnimatedPage><Address /></AnimatedPage>} />
              <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
              <Route path="/legal/:type" element={<AnimatedPage><LegalPage /></AnimatedPage>} />
              <Route path="/checkout/success" element={<AnimatedPage><CheckoutSuccess /></AnimatedPage>} />
              <Route path="/admin" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
              <Route path="/admin/menu" element={<AnimatedPage><MenuManagement /></AnimatedPage>} />
              <Route path="/admin/branches" element={<AnimatedPage><BranchManagement /></AnimatedPage>} />
              <Route path="/admin/customise" element={<AnimatedPage><Customise /></AnimatedPage>} />
              <Route path="/admin/coupons" element={<AnimatedPage><CouponManagement /></AnimatedPage>} />
              <Route path="/admin/orders" element={<AnimatedPage><OrderManagement /></AnimatedPage>} />
              <Route path="/admin/reservations" element={<AnimatedPage><ReservationManagement /></AnimatedPage>} />
              <Route path="/admin/users" element={<AnimatedPage><UserManagement /></AnimatedPage>} />
              <Route path="/admin/customers" element={<AnimatedPage><CustomerManagement /></AnimatedPage>} />
              <Route path="/admin/configure" element={<AnimatedPage><Configure /></AnimatedPage>} />
              <Route path="/admin/staff" element={<AnimatedPage><StaffDashboard /></AnimatedPage>} />
              <Route path="/admin/statistics" element={<AnimatedPage><Statistics /></AnimatedPage>} />
              <Route path="/admin/reports" element={<AnimatedPage><Reports /></AnimatedPage>} />
              <Route path="/admin/broadcast" element={<AnimatedPage><SocialMediaManagement /></AnimatedPage>} />
              <Route path="/admin/social-media" element={<AnimatedPage><SocialMediaManagement /></AnimatedPage>} />
              <Route path="/admin/qr-menu" element={<AnimatedPage><QRCodeMenu /></AnimatedPage>} />
              <Route path="/qr-menu/:branchId" element={<BranchMenu />} />
              <Route path="/staff" element={<AnimatedPage><StaffOrders /></AnimatedPage>} />
              <Route path="/staff/reservations" element={<AnimatedPage><StaffReservations /></AnimatedPage>} />
              <Route path="/staff/history" element={<AnimatedPage><StaffOrderHistory /></AnimatedPage>} />
              <Route path="/staff/report" element={<AnimatedPage><StaffReport /></AnimatedPage>} />
              <Route path="/order-tracking/:orderId" element={<AnimatedPage><OrderTracking /></AnimatedPage>} />
              <Route path="/driver-dashboard" element={<AnimatedPage><DriverDashboard /></AnimatedPage>} />
              <Route path="/driver" element={<DriverOrders />} />
              <Route path="/driver/active" element={<DriverActiveDelivery />} />
              <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

const AppContent = () => {
  const { branding, isLoading: brandingLoading, isError: brandingError } = useBranding();
  const { branch, loading: branchLoading, error: branchError } = useBranch();
  const { isAuthReady, user } = useAuth();
  const qc = useQueryClient();
  
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  // Prefetch saved cards only after auth is ready and user exists
  useEffect(() => {
    if (isAuthReady && user) {
      prefetchSavedCards(qc);
    }
  }, [isAuthReady, user, qc]);

  // On app resume: refresh auth first, then selectively invalidate core data
  useAppLifecycle(useCallback(async () => {
    console.log('[App] Resumed — refreshing session then core data');
    // 1. Restore auth session first (ensures token is valid for RLS)
    const { refreshSession } = await import('@/contexts/AuthContext').then(m => ({ refreshSession }));
    await refreshSession();
    // 2. Only invalidate core bootstrap queries — pages handle their own via resumeCounter
    qc.invalidateQueries({ queryKey: ['branch-data'] });
    qc.invalidateQueries({ queryKey: ['branding'] });
  }, [qc, refreshSession]));
  
  // Auto-detect location on every app launch (deferred until bootstrap is complete)
  useEffect(() => {
    if (!bootstrapComplete) return;
    
    const detectLocation = async () => {
      if (!navigator.geolocation) return;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: true,
          });
        });
        
        const { latitude, longitude } = position.coords;
        console.log('[App] Location detected:', latitude, longitude);
        
        const { data } = await supabase.functions.invoke('geocode-location', {
          body: { latitude, longitude }
        });
        
        const address = data?.address || 'Current location';
        
        localStorage.setItem('currentLocationData', JSON.stringify({
          address, latitude, longitude,
        }));
        
        const savedAddress = localStorage.getItem('selectedDeliveryAddress');
        if (!savedAddress) {
          localStorage.setItem('selectedDeliveryAddress', 'current-location');
        }
        
        window.dispatchEvent(new Event('addressChanged'));
      } catch (error) {
        console.log('[App] Location detection failed:', error);
      }
    };
    
    detectLocation();
  }, [bootstrapComplete]);

  // Minimum display time on first session load
  useEffect(() => {
    const hasLoadedBefore = sessionStorage.getItem('appLoaded');
    if (hasLoadedBefore) {
      setMinTimeElapsed(true);
      return;
    }
    sessionStorage.setItem('appLoaded', 'true');
    const timer = setTimeout(() => setMinTimeElapsed(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Bootstrap gate: wait for auth + core data
  useEffect(() => {
    if (!isAuthReady) return; // Auth not restored yet — keep waiting
    if (!minTimeElapsed) return; // Still in splash min time
    
    const coreDataSettled = !brandingLoading && !branchLoading;
    if (!coreDataSettled) return; // Core queries still in flight / retrying
    
    const bothErrored = brandingError && branchError;
    
    if (bothErrored && !branding && !branch) {
      console.error('[App] Bootstrap failed — both branding and branch errored');
      setConnectionFailed(true);
      setShowLoadingScreen(false);
    } else {
      console.log('[App] Bootstrap complete — branding:', !!branding, 'branch:', !!branch);
      setConnectionFailed(false);
      setShowLoadingScreen(false);
      setBootstrapComplete(true);
    }
  }, [isAuthReady, brandingLoading, branchLoading, brandingError, branchError, branding, branch, minTimeElapsed]);

  const handleRetry = useCallback(() => {
    setConnectionFailed(false);
    setShowLoadingScreen(true);
    setMinTimeElapsed(false);
    qc.invalidateQueries();
    setTimeout(() => setMinTimeElapsed(true), 1200);
  }, [qc]);
  
  // Connection failed screen
  if (connectionFailed && !showLoadingScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl mb-2">📡</div>
          <h2 className="text-xl font-semibold text-foreground">Connection failed</h2>
          <p className="text-muted-foreground text-sm">
            We couldn't reach the server. Please check your internet connection and try again.
          </p>
          <button
            onClick={handleRetry}
            className="mt-4 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-base active:scale-95 transition-transform"
          >
            Tap to retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Only render app tree after bootstrap is complete to prevent race conditions */}
      {bootstrapComplete && (
        <div>
          <Toaster />
          <Sonner />
          <GlobalDriverTracker />
          <PhonePromptDialog />
          <BrowserRouter>
            <ScrollToTop />
            <PageTransitionProvider>
              <AppRoutes />
            </PageTransitionProvider>
          </BrowserRouter>
        </div>
      )}
      {showLoadingScreen && <LoadingScreen show={true} />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
