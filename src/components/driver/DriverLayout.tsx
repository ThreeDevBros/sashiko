import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Package, Truck, ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface DriverLayoutProps {
  children: ReactNode;
}

export const DriverLayout = ({ children }: DriverLayoutProps) => {
  const { userRoles, loading } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const hasDriverRole = userRoles.includes('delivery') || userRoles.includes('admin');

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

  if (!hasDriverRole) {
    const isStaffOnly = userRoles.includes('staff') || userRoles.includes('manager') || userRoles.includes('branch_manager');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          {isStaffOnly ? "Staff should use the Staff Panel" : "You don't have delivery driver privileges"}
        </p>
        <Button onClick={() => navigate(isStaffOnly ? '/staff' : '/')}>
          {isStaffOnly ? 'Go to Staff Panel' : 'Go Home'}
        </Button>
      </div>
    );
  }

  const navItems = [
    { path: '/driver', label: 'Available Orders', icon: Package },
    { path: '/driver/active', label: 'Active Delivery', icon: Truck },
  ];

  const isDriverOnly = userRoles.includes('delivery') && !userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('branch_manager');

  const handleBackToApp = async () => {
    if (isDriverOnly) {
      await supabase.auth.signOut();
      navigate('/auth');
    } else {
      navigate('/');
    }
  };

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
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? "bottom" : "right"} className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {!isMobile && (
        <aside className="flex flex-col items-center w-[60px] border-r bg-card/50 backdrop-blur-sm py-4 gap-1 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <nav className="flex flex-col items-center gap-1.5 flex-1">
            <NavItems />
          </nav>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleBackToApp}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-2"
              >
                {isDriverOnly ? <LogOut className="w-[18px] h-[18px]" /> : <ArrowLeft className="w-[18px] h-[18px]" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{isDriverOnly ? 'Sign Out' : 'Back to App'}</TooltipContent>
          </Tooltip>
        </aside>
      )}

      {isMobile && (
        <>
          <div className="fixed top-0 left-0 right-0 border-b bg-card/80 backdrop-blur-md flex items-center justify-between px-4 z-50" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(4rem + env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
                {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <span className="text-base font-bold text-primary">Driver</span>
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
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-auto pt-4 border-t border-border">
                  <button
                    onClick={() => { setMobileSidebarOpen(false); handleBackToApp(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-full"
                  >
                    {isDriverOnly ? <LogOut className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    <span>{isDriverOnly ? 'Sign Out' : 'Back to App'}</span>
                  </button>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      <main className={cn("flex-1 overflow-y-auto")} style={isMobile ? { paddingTop: 'calc(4rem + env(safe-area-inset-top))' } : undefined}>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
