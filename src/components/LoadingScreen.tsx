import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import sashikoLogo from '@/assets/sashiko-logo.png';
import heroFood from '@/assets/hero-food.jpg';

interface LoadingScreenProps {
  show?: boolean;
  onComplete?: () => void;
}

// Minimal gold icons as fallback
const MenuIcon = ({ type }: { type: string }) => {
  const getPath = () => {
    switch (type.toLowerCase()) {
      case 'sushi':
        return "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
      case 'noodles':
      case 'ramen':
        return "M3 3h18v4H3V3zm0 6h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v4H3v-4z";
      case 'dumpling':
      case 'dumplings':
        return "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z";
      default:
        return "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
    }
  };

  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
    >
      <path d={getPath()} />
    </svg>
  );
};

const LoadingScreen = ({ show = true, onComplete }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  // Fetch featured menu items for circular icons
  const { data: menuItems } = useQuery({
    queryKey: ['loading-menu-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, image_url, category_id')
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      return data || [];
    },
    enabled: show,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!show && isVisible) {
      // Fade out animation
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        onComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    } else if (show && !isVisible) {
      setShouldRender(true);
      setIsVisible(true);
    }
  }, [show, isVisible, onComplete]);

  if (!shouldRender) return null;

  const foodIcons = menuItems?.slice(0, 8) || [];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ 
        background: 'linear-gradient(135deg, hsl(0 0% 5%) 0%, hsl(0 0% 0%) 100%)',
      }}
    >
      {/* Blurred background image with vignette */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url(${heroFood})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px)',
        }}
      />
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-md w-full">
        {/* Circular food icons around logo with rotation */}
        <div className="relative w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 mb-8">
          {/* Logo in center with gold glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="bg-white rounded-2xl p-6 shadow-2xl"
              style={{
                boxShadow: '0 0 40px hsl(43 48% 58% / 0.4), 0 0 80px hsl(43 48% 58% / 0.2)',
              }}
            >
              <img 
                src={sashikoLogo}
                alt="Restaurant Logo"
                className="w-28 h-28 md:w-32 md:h-32 object-contain"
              />
            </div>
          </div>

          {/* Rotating orbit container */}
          <div className="absolute inset-0 animate-orbit">
            {foodIcons.map((item, index) => {
              const angle = (index * 360) / foodIcons.length;
              const radius = 140; // Distance from center
              const x = Math.cos((angle - 90) * (Math.PI / 180)) * radius;
              const y = Math.sin((angle - 90) * (Math.PI / 180)) * radius;
              
              return (
                <div
                  key={item.id}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  <div 
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center backdrop-blur-md animate-float"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                      animationDelay: `${index * 0.15}s`,
                    }}
                  >
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-full"
                        style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg)' }}
                      />
                    ) : (
                      <MenuIcon type={item.name} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-foreground text-xl md:text-2xl font-semibold">
            Preparing your order…
          </h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Fetching your menu and nearby branches
          </p>
        </div>

        {/* 3-dot pulsing animation */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full animate-pulse-dot"
              style={{ 
                background: 'hsl(43 48% 58%)',
                animationDelay: `${i * 0.2}s` 
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-orbit {
          animation: orbit 12s linear infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }

        .animate-pulse-dot {
          animation: pulse-dot 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
