import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useBranding } from "./hooks/useBranding";
import { useBranch } from "./hooks/useBranch";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PageTransitionProvider } from "./contexts/PageTransitionContext";
import { AnimatedPage } from "./components/AnimatedPage";
import LoadingScreen from "./components/LoadingScreen";
import { TopNav } from "./components/TopNav";
import { ScrollToTop } from "./components/ScrollToTop";
import { GlobalDriverTracker } from "./components/driver/GlobalDriverTracker";
import { PhonePromptDialog } from "./components/PhonePromptDialog";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getRoleBasedRoute, isRouteAllowedForRoles } from "./hooks/useRoleRedirect";
import { usePushNotifications } from "./hooks/usePushNotifications";
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

import { prefetchSavedCards } from './hooks/useSavedCards';

const queryClient = new QueryClient();

// Prefetch saved cards at app startup so checkout doesn't flash
prefetchSavedCards(queryClient);

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  usePushNotifications(navigate);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStaffRoute = location.pathname.startsWith('/staff');
  const isDriverRoute = location.pathname.startsWith('/driver');
  const isAuthRoute = location.pathname === '/auth';
  const isQrMenuRoute = location.pathname.startsWith('/qr-menu');
  const showNav = !isAdminRoute && !isStaffRoute && !isDriverRoute && !isAuthRoute && !isQrMenuRoute;
  
  // Role-based route protection — wait for auth to be ready
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

  // Check if first time visitor and redirect to auth (only on true first visit, not on every reload)
  useEffect(() => {
    if (!isAuthReady) return;
    const hasVisited = localStorage.getItem('hasVisited');
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding');
    
    // Don't redirect away from critical post-checkout flows
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
        {/* Main Content */}
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
  const { branding, isLoading: brandingLoading } = useBranding();
  const { branch, loading: branchLoading } = useBranch();
  const { isAuthReady } = useAuth();
  const isFetching = useIsFetching();
  
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  
  // Auto-detect location on every app launch and update current location
  useEffect(() => {
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
        console.log('App launch - Location detected:', latitude, longitude);
        
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
        console.log('App launch - Current location updated to:', address);
      } catch (error) {
        console.log('App launch - Location detection failed:', error);
      }
    };
    
    detectLocation();
  }, []);

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

  // Max timeout safety valve — extended for slow native connections
  useEffect(() => {
    if (!showLoadingScreen) return;
    const timer = setTimeout(() => setShowLoadingScreen(false), 12000);
    return () => clearTimeout(timer);
  }, [showLoadingScreen]);

  // Dismiss once ALL queries settled, core data ready, auth ready, and min time elapsed
  useEffect(() => {
    if (!brandingLoading && !branchLoading && isAuthReady && isFetching === 0 && minTimeElapsed) {
      setShowLoadingScreen(false);
    }
  }, [brandingLoading, branchLoading, isAuthReady, isFetching, minTimeElapsed]);
  
  return (
    <>
      {/* Always render app so queries start immediately */}
      <div style={{ visibility: showLoadingScreen ? 'hidden' : 'visible' }}>
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
