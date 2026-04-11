import { useEffect, useState } from 'react';
import sashikoLogo from '@/assets/sashiko-logo.png';

interface LoadingScreenProps {
  show?: boolean;
  onComplete?: () => void;
}

const LoadingScreen = ({ show = true, onComplete }: LoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (!show && isVisible) {
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

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ 
        background: 'linear-gradient(135deg, hsl(0 0% 5%) 0%, hsl(0 0% 0%) 100%)',
      }}
    >
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-md w-full">
        {/* Logo */}
        <div className="mb-8">
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

        {/* Loading text */}
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-white text-xl md:text-2xl font-semibold">
            Preparing your experience…
          </h2>
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
