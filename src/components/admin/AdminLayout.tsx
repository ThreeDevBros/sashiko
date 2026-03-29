import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useBranding } from '@/hooks/useBranding';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  MapPin, 
  Palette, 
  ShoppingCart,
  Users,
  UserCircle,
  Calendar,
  Menu,
  X,
  Settings,
  FileText,
  ArrowLeft,
  LogOut,
  Share2,
  QrCode
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';


interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * SECURITY NOTE: UI-Only Access Control
 * 
 * This component checks user roles for navigation purposes only.
 * Real security is enforced by Row-Level Security (RLS) policies in the database.
 * All admin data operations are protected server-side via the has_role() function.
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { isAdmin, userRole, loading } = useAdmin();
  const { hasPermission, loading: permissionsLoading, isAdmin: permissionsIsAdmin } = usePermissions();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Use admin status from either hook (belt and suspenders approach)
  const userIsAdmin = isAdmin || permissionsIsAdmin;
  

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);


  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userRole || userRole === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have staff privileges</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  // Redirect staff to simplified dashboard
  if (userRole === 'staff' || userRole === 'delivery') {
    if (location.pathname !== '/admin/staff') {
      navigate('/staff');
      return null;
    }
    return <div className="w-full">{children}</div>;
  }

  const allNavItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
    { path: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, permission: 'manage_menu' },
    { path: '/admin/branches', label: 'Branches', icon: MapPin, permission: 'manage_branches' },
    { path: '/admin/customise', label: 'Customise', icon: Palette, permission: 'manage_customise' },
    { path: '/admin/orders', label: 'Orders', icon: ShoppingCart, permission: 'manage_orders' },
    { path: '/admin/reservations', label: 'Reservations', icon: Calendar, permission: 'manage_reservations' },
    { path: '/admin/users', label: 'Staff', icon: Users, permission: 'manage_staff' },
    { path: '/admin/customers', label: 'Customers', icon: UserCircle, permission: 'view_customers' },
    { path: '/admin/statistics', label: 'Statistics', icon: FileText, permission: 'view_statistics' },
    { path: '/admin/reports', label: 'Reports', icon: FileText, permission: 'view_reports' },
    { path: '/admin/broadcast', label: 'Broadcast', icon: Share2, permission: 'manage_broadcast' },
    { path: '/admin/qr-menu', label: 'QR Code for Menu', icon: QrCode, permission: 'manage_qr_menu' },
    { path: '/admin/configure', label: 'Configure', icon: Settings, permission: 'manage_configure' },
  ];

  // Filter navigation items based on permissions
  const navItems = allNavItems.filter(item => {
    // Admins see everything
    if (userIsAdmin) return true;
    
    // Dashboard is always visible to all staff roles
    if (item.path === '/admin') return true;
    
    // Check specific permission for other items
    return hasPermission(item.permission);
  });

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 border-b bg-card flex items-center justify-between px-4 flex-shrink-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(4rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-primary">{branding?.tenant_name || 'eFood'} Admin</h1>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`
            fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            border-r bg-card shadow-lg
          `}
          style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}
        >
          <nav className="p-4 space-y-2 flex flex-col h-full overflow-y-auto">
            <div className="space-y-2 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t pt-3 mt-3 space-y-1">
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-muted text-muted-foreground"
              >
                <ArrowLeft className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Back to App</span>
              </Link>
              <button
                onClick={async () => {
                  setSidebarOpen(false);
                  await supabase.auth.signOut();
                  navigate('/auth');
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-muted text-muted-foreground w-full text-left"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Sign Out</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
