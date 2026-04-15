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
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleBasedRoute, isRouteAllowedForRoles } from "./hooks/useRoleRedirect";
import { prefetchSavedCards } from './hooks/useSavedCards';
import { handleGlobalResume } from "@/lib/lifecycleManager";
import { restoreLiveActivityMappings } from "@/lib/nativeLiveActivity";
import { AppRuntimeListeners } from "./components/AppRuntimeListeners";
import { BranchRealtimeManager } from "./components/BranchRealtimeManager";
// Critical pages — loaded eagerly for instant navigation
import Index from "./pages/Index";
import Order from "./pages/Order";
import NotFound from "./pages/NotFound";

const Auth = lazy(() => import("./pages/Auth"));

// All other pages — lazy-loaded on first visit
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const ReservationHistory = lazy(() => import("./pages/ReservationHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const TableBooking = lazy(() => import("./pages/TableBooking"));
const Address = lazy(() => import("./pages/Address"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverOrders = lazy(() => import("./pages/driver/DriverOrders"));
const DriverActiveDelivery = lazy(() => import("./pages/driver/DriverActiveDelivery"));
const AccountDeletion = lazy(() => import("./pages/AccountDeletion"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const MenuManagement = lazy(() => import("./pages/admin/MenuManagement"));
const BranchManagement = lazy(() => import("./pages/admin/BranchManagement"));
const Customise = lazy(() => import("./pages/admin/Customise"));
const CouponManagement = lazy(() => import("./pages/admin/CouponManagement"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const CustomerManagement = lazy(() => import("./pages/admin/CustomerManagement"));
const ReservationManagement = lazy(() => import("./pages/admin/ReservationManagement"));
const Configure = lazy(() => import("./pages/admin/Configure"));
const StaffDashboard = lazy(() => import("./pages/admin/StaffDashboard"));
const Statistics = lazy(() => import("./pages/admin/Statistics"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const SocialMediaManagement = lazy(() => import("./pages/admin/SocialMediaManagement"));
const QRCodeMenu = lazy(() => import("./pages/admin/QRCodeMenu"));
const BranchMenu = lazy(() => import("./pages/BranchMenu"));
const StaffOrders = lazy(() => import("./pages/staff/StaffOrders"));
const StaffReservations = lazy(() => import("./pages/staff/StaffReservations"));
const StaffOrderHistory = lazy(() => import("./pages/staff/StaffOrderHistory"));
const StaffReport = lazy(() => import("./pages/staff/StaffReport"));
const Support = lazy(() => import("./pages/Support"));
const AccountDeletionInfo = lazy(() => import("./pages/AccountDeletionInfo"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1500,
      networkMode: 'always',
      refetchOnReconnect: 'always',
      staleTime: 2 * 60 * 1000,
    },
  },
});

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthReady, isAuthRecovering } = useAuth();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStaffRoute = location.pathname.startsWith('/staff');
  const isDriverRoute = location.pathname.startsWith('/driver');
  const isAuthRoute = location.pathname === '/auth';
  const isQrMenuRoute = location.pathname.startsWith('/qr-menu');
  const showNav = !isAdminRoute && !isStaffRoute && !isDriverRoute && !isAuthRoute && !isQrMenuRoute;
  
  // Cache roles to avoid refetching on every route change
  const [cachedRoles, setCachedRoles] = useState<string[] | null>(null);
  const lastRoleUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    // Don't redirect while auth is recovering after app resume — session may not be restored yet
    if (isAuthRecovering) return;

    const checkRoleAccess = async () => {
      if (isAuthRoute || isQrMenuRoute) return;

      const isProtectedPanel = location.pathname.startsWith('/admin') ||
                               location.pathname.startsWith('/staff') ||
                               location.pathname.startsWith('/driver');

      if (!user) {
        setCachedRoles(null);
        lastRoleUserId.current = null;
        if (isProtectedPanel) {
          navigate('/auth', { replace: true });
        }
        return;
      }

      // Only fetch roles if user changed (not on every route change)
      let roles = cachedRoles;
      if (lastRoleUserId.current !== user.id || !roles) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        roles = roleData?.map(r => r.role) || [];
        setCachedRoles(roles);
        lastRoleUserId.current = user.id;
      }
      
      if (!isRouteAllowedForRoles(location.pathname, roles)) {
        const correctRoute = getRoleBasedRoute(roles);
        navigate(correctRoute, { replace: true });
      }
    };
    
    checkRoleAccess();
  }, [location.pathname, navigate, isAuthRoute, isQrMenuRoute, isAuthReady, isAuthRecovering, user]);

  useEffect(() => {
    if (!isAuthReady) return;
    // Don't redirect signed-in users to auth page
    if (user) return;
    
    const hasVisited = localStorage.getItem('hasVisited');
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
    
    const isProtectedRoute = location.pathname.startsWith('/order-tracking') || 
                              location.pathname.startsWith('/checkout');
    
    if (!hasVisited && !hasCompletedOnboarding && location.pathname === '/' && !isProtectedRoute) {
      localStorage.setItem('hasVisited', 'true');
      navigate('/auth');
    }
  }, [location.pathname, navigate, isAuthReady, user]);
  
  return (
    <>
      <div className="flex w-full min-h-screen">
        <div className="flex-1 w-full" style={{ overflowX: 'clip' }}>
          
          <Suspense fallback={null}>
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
                <Route path="/account/delete" element={<AnimatedPage><AccountDeletion /></AnimatedPage>} />
                <Route path="/legal/:type" element={<AnimatedPage><LegalPage /></AnimatedPage>} />
                <Route path="/support" element={<Suspense fallback={null}><Support /></Suspense>} />
                <Route path="/account-deletion-info" element={<Suspense fallback={null}><AccountDeletionInfo /></Suspense>} />
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
                <Route path="/qr-menu/:branchId" element={<Suspense fallback={null}><BranchMenu /></Suspense>} />
                <Route path="/staff" element={<AnimatedPage><StaffOrders /></AnimatedPage>} />
                <Route path="/staff/reservations" element={<AnimatedPage><StaffReservations /></AnimatedPage>} />
                <Route path="/staff/history" element={<AnimatedPage><StaffOrderHistory /></AnimatedPage>} />
                <Route path="/staff/report" element={<AnimatedPage><StaffReport /></AnimatedPage>} />
                <Route path="/order-tracking/:orderId" element={<AnimatedPage><OrderTracking /></AnimatedPage>} />
                <Route path="/driver-dashboard" element={<AnimatedPage><DriverDashboard /></AnimatedPage>} />
                <Route path="/driver" element={<Suspense fallback={null}><DriverOrders /></Suspense>} />
                <Route path="/driver/active" element={<Suspense fallback={null}><DriverActiveDelivery /></Suspense>} />
                <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </div>
      </div>
    </>
  );
};

const AppContent = () => {
  const { branding, isLoading: brandingLoading, isError: brandingError } = useBranding();
  const { branch, loading: branchLoading, error: branchError } = useBranch();
  const { isAuthReady, isAuthRecovering, user, refreshSession } = useAuth();
  const qc = useQueryClient();
  
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const hasBootstrapped = useRef(false);

  // Prefetch saved cards only after auth is ready and user exists
  useEffect(() => {
    if (isAuthReady && user) {
      prefetchSavedCards(qc);
    }
  }, [isAuthReady, user, qc]);

  useEffect(() => {
    void restoreLiveActivityMappings();
  }, []);

  // Track previous user ID to avoid unnecessary query invalidation on resume
  const prevUserIdRef = useRef<string | null>(null);

  // Shared resume handler: refresh session, notify subscribers, selectively invalidate queries
  const doResume = useCallback(async () => {
    const didRun = await handleGlobalResume(refreshSession);
    if (didRun) {
      // Only invalidate queries if user identity actually changed
      const currentUserId = user?.id ?? null;
      if (prevUserIdRef.current !== currentUserId) {
        prevUserIdRef.current = currentUserId;
        queryClient.invalidateQueries();
      }
    }
  }, [refreshSession, user?.id]);

  // Native iOS/Android: appStateChange
  useEffect(() => {
    let disposed = false;
    let removeListener: (() => void) | null = null;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.getPlatform() === 'web') return;

        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return;
          console.log('[AppLifecycle] Native resume fired');
          await doResume();
        });

        if (disposed) {
          await listener.remove();
          return;
        }

        removeListener = () => {
          void listener.remove();
        };
      } catch (error) {
        console.warn('[AppLifecycle] Failed to register native listener:', error);
      }
    })();

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [doResume]);

  // Web / PWA fallback: visibilitychange
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AppLifecycle] Visibility resume fired');
        void doResume();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [doResume]);
  
  // Auto-detect location on every app launch (deferred until bootstrap is complete)
  useEffect(() => {
    if (!bootstrapComplete) return;
    
    // Skip if useNearestBranch already cached location data
    const existingLocation = localStorage.getItem('currentLocationData');
    if (existingLocation) {
      console.log('[App] Location already cached, skipping duplicate geocode');
      return;
    }

    const detectLocation = async () => {
      if (!isGeolocationAvailable()) return;
      
      try {
        const position = await getCurrentPosition({
          timeout: 10000,
          enableHighAccuracy: true,
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
    
    // Proceed if queries settled OR we already have data (from cache/initialData)
    const hasData = !!branding || !!branch;
    const coreDataSettled = !brandingLoading && !branchLoading;
    if (!coreDataSettled && !hasData) return; // Still loading with no cached data
    
    const bothErrored = brandingError && branchError;
    
    if (bothErrored && !branding && !branch) {
      if (!hasBootstrapped.current) {
        console.error('[App] Bootstrap failed — both branding and branch errored');
        setConnectionFailed(true);
        setShowLoadingScreen(false);
      }
    } else if (!hasBootstrapped.current) {
      console.log('[App] Bootstrap complete — branding:', !!branding, 'branch:', !!branch);
      hasBootstrapped.current = true;
      setConnectionFailed(false);
      setShowLoadingScreen(false);
      setBootstrapComplete(true);
    }
  }, [isAuthReady, brandingLoading, branchLoading, brandingError, branchError, branding, branch, minTimeElapsed]);

  // Global safety timeout — never stay stuck on loading screen
  useEffect(() => {
    if (!showLoadingScreen) return;
    const timer = setTimeout(() => {
      if (showLoadingScreen && !hasBootstrapped.current) {
        console.warn('[App] Safety timeout — forcing bootstrap complete');
        hasBootstrapped.current = true;
        // If we have NO data at all, show connection failed screen
        const hasAnyData = !!branding || !!branch;
        if (!hasAnyData) {
          console.warn('[App] No data available — showing connection failed');
          setConnectionFailed(true);
        }
        setShowLoadingScreen(false);
        setBootstrapComplete(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [showLoadingScreen, branding, branch]);

  const handleRetry = useCallback(() => {
    hasBootstrapped.current = false;
    setConnectionFailed(false);
    setShowLoadingScreen(true);
    setBootstrapComplete(false);
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
      {/* Render app tree after bootstrap completes. Auth recovery no longer gates the UI —
          the authVersion key forces a clean remount when the session is restored. */}
      {bootstrapComplete && (
        <div>
          <Toaster />
          <Sonner />
          <BranchRealtimeManager />
          <GlobalDriverTracker />
          <PhonePromptDialog />
          <BrowserRouter>
            <AppRuntimeListeners />
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
