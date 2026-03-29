import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart,
  Calendar,
  Clock,
  FileText,
  Menu,
  X,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NewOrderPopup } from '@/components/staff/NewOrderPopup';
import { NewReservationPopup } from '@/components/staff/NewReservationPopup';
import { StaffBranchProvider, useStaffBranch } from '@/contexts/StaffBranchContext';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';

const BranchBanner = () => {
  const { selectedBranchName, isLoading } = useStaffBranch();
  if (isLoading) return null;
  return (
    <div className="mb-4 flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2.5 border border-border/50">
      <MapPin className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-foreground">
        {selectedBranchName || 'No branch assigned'}
      </span>
    </div>
  );
};

interface StaffLayoutProps {
  children: ReactNode;
}

const StaffLayoutInner = ({ children }: StaffLayoutProps) => {
  const { hasStaffRole, userRoles, loading } = usePermissions();
  const hasDriverOnlyRole = userRoles.includes('delivery') && !userRoles.includes('staff') && !userRoles.includes('manager') && !userRoles.includes('branch_manager') && !userRoles.includes('admin');
  const isStaffOnly = userRoles.includes('staff') && !userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('branch_manager');
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { selectedBranchId } = useStaffBranch();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['staff-pending-count', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return 0;
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('branch_id', selectedBranchId);
      return count || 0;
    },
    enabled: !!selectedBranchId,
  });

  const { data: pendingReservations = 0 } = useQuery({
    queryKey: ['staff-pending-reservations', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return 0;
      const { count } = await supabase
        .from('table_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('branch_id', selectedBranchId);
      return count || 0;
    },
    enabled: !!selectedBranchId,
  });

  const handleBackToApp = async () => {
    if (isStaffOnly) {
      await supabase.auth.signOut();
      navigate('/auth');
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasStaffRole || hasDriverOnlyRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          {hasDriverOnlyRole ? "Drivers should use the Driver Panel" : "You don't have staff privileges"}
        </p>
        <Button onClick={() => navigate(hasDriverOnlyRole ? '/driver' : '/')}>
          {hasDriverOnlyRole ? 'Go to Driver Panel' : 'Go Home'}
        </Button>
      </div>
    );
  }

  const navItems = [
    { path: '/staff', label: 'Orders', icon: ShoppingCart, badge: pendingCount },
    { path: '/staff/reservations', label: 'Reservations', icon: Calendar, badge: pendingReservations },
    { path: '/staff/history', label: 'History', icon: Clock },
    { path: '/staff/report', label: 'Report', icon: FileText },
  ];


  const NavItems = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.badge !== undefined && (
                  <span className={cn(
                    "absolute -top-1 -right-1 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background",
                    item.badge > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? "bottom" : "right"} className="text-xs">
              {item.label}
              {item.badge !== undefined ? ` (${item.badge})` : ''}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar — slim icon rail */}
      {!isMobile && (
        <aside className="flex flex-col items-center w-[60px] border-r bg-card/50 backdrop-blur-sm py-4 gap-1 flex-shrink-0">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <span className="text-sm font-bold text-primary">S</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col items-center gap-1.5 flex-1">
            <NavItems />
          </nav>

          {/* Back */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
               <button
                onClick={handleBackToApp}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-2"
              >
                {isStaffOnly ? <LogOut className="w-[18px] h-[18px]" /> : <ArrowLeft className="w-[18px] h-[18px]" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{isStaffOnly ? 'Sign Out' : 'Back to App'}</TooltipContent>
          </Tooltip>
        </aside>
      )}

      {/* Mobile header */}
      {isMobile && (
        <>
          <div className="fixed top-0 left-0 right-0 border-b bg-card/80 backdrop-blur-md flex items-center justify-between px-4 z-50" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(4rem + env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
                {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <span className="text-base font-bold text-primary">Staff</span>
            </div>
            
          </div>

          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 top-16" onClick={() => setMobileSidebarOpen(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <aside className="absolute left-0 top-0 bottom-0 w-56 bg-card border-r shadow-xl p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <nav className="flex flex-col gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className={cn(
                            "ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5",
                            item.badge > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-auto pt-4 border-t border-border">
                  <button
                    onClick={() => { setMobileSidebarOpen(false); handleBackToApp(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-full"
                  >
                    {isStaffOnly ? <LogOut className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    <span>{isStaffOnly ? 'Sign Out' : 'Back to App'}</span>
                  </button>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 overflow-y-auto")} style={isMobile ? { paddingTop: 'calc(4rem + env(safe-area-inset-top))' } : undefined}>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <BranchBanner />
          {children}
        </div>
      </main>

      {/* Global new order popup - works on all staff pages */}
      <NewOrderPopup />
      <NewReservationPopup />
    </div>
  );
};

export const StaffLayout = ({ children }: StaffLayoutProps) => {
  return (
    <StaffBranchProvider>
      <StaffLayoutInner>{children}</StaffLayoutInner>
    </StaffBranchProvider>
  );
};
