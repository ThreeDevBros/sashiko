import { ShoppingCart, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { usePageTransition } from '@/contexts/PageTransitionContext';
import { useBranch } from '@/hooks/useBranch';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { toast } from 'sonner';

interface BottomNavProps {
  onCheckout?: () => void;
  checkoutLoading?: boolean;
}

export const BottomNav = ({ onCheckout, checkoutLoading = false }: BottomNavProps = {}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount, total } = useCart();
  const { setTransitionPosition } = usePageTransition();
  const { branch } = useBranch();
  const branchIsPaused = branch?.is_paused === true;
  const haptics = useHaptics();
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const prevItemCountRef = useRef(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const lastTapTimeRef = useRef<number>(0);
  const [showDoubleTapHint, setShowDoubleTapHint] = useState(false);
  const prevLocationRef = useRef(location.pathname);

  // Reset animation when route changes
  useEffect(() => {
    if (prevLocationRef.current !== location.pathname) {
      setShouldAnimate(false);
      setIsNavigating(false);
      prevLocationRef.current = location.pathname;
    }
  }, [location.pathname]);

  // Only animate when items are added (not during navigation)
  useEffect(() => {
    if (itemCount > prevItemCountRef.current && !isNavigating && prevLocationRef.current === location.pathname) {
      setShouldAnimate(true);
      const timer = setTimeout(() => setShouldAnimate(false), 500);
      prevItemCountRef.current = itemCount;
      return () => clearTimeout(timer);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount, isNavigating, location.pathname]);

  // Only show when cart has items
  if (itemCount === 0) {
    return null;
  }

  const isOnCartPage = location.pathname === '/cart';
  const isOnCheckoutPage = location.pathname === '/checkout';
  
  let buttonText = branchIsPaused ? t('cart.branchBusy') : t('cart.viewOrder');
  if (!branchIsPaused) {
    if (isOnCheckoutPage) {
      buttonText = showDoubleTapHint ? t('cart.doubleTapConfirm') : t('cart.doubleTapComplete');
    } else if (isOnCartPage) {
      buttonText = t('cart.goToCheckout');
    }
  }
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (branchIsPaused) {
      toast.error('This branch is currently busy and not accepting orders.');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setTransitionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    
    haptics.light();
    setIsNavigating(true);
    setShouldAnimate(false);
    
    if (isOnCheckoutPage) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      
      if (timeSinceLastTap < 500 && lastTapTimeRef.current > 0) {
        // Second tap within 500ms - complete the order
        haptics.success();
        lastTapTimeRef.current = 0;
        setShowDoubleTapHint(false);
        if (onCheckout) {
          onCheckout();
        }
      } else {
        // First tap - show hint and wait for second tap
        haptics.warning();
        lastTapTimeRef.current = now;
        setShowDoubleTapHint(true);
        setIsNavigating(false);
        
        // Reset hint after 500ms
        setTimeout(() => {
          setShowDoubleTapHint(false);
          lastTapTimeRef.current = 0;
        }, 500);
      }
    } else if (isOnCartPage) {
      navigate('/checkout');
    } else {
      navigate('/cart');
    }
  };
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md lg:max-w-2xl mx-auto px-4 pb-6">
        <Button
          onClick={handleClick}
          disabled={checkoutLoading}
          style={{ transform: 'none' }}
          className={cn(
            "w-full h-[64px] rounded-[20px] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] text-base font-semibold flex items-center justify-between px-6 transition-colors",
            branchIsPaused && "bg-destructive hover:bg-destructive/90",
            showDoubleTapHint && !branchIsPaused && "bg-accent hover:bg-accent",
            "!active:scale-100 !active:transform-none hover:shadow-[0_-4px_20px_rgba(0,0,0,0.08)]",
            shouldAnimate && "animate-cart-bounce"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
              {branchIsPaused 
                ? <AlertCircle className="w-4 h-4 text-white" />
                : <span className="text-white font-bold text-sm">{itemCount}</span>
              }
            </div>
            <span>{buttonText}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold">€{total.toFixed(2)}</span>
            <ShoppingCart className="w-5 h-5" />
          </div>
        </Button>
      </div>
    </nav>
  );
};
