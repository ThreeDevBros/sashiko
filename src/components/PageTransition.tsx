import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'fade-in' | 'fade-out'>('fade-in');

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('fade-out');
    }
  }, [location, displayLocation]);

  return (
    <div
      className={`w-full h-full transition-all duration-500 ease-out ${
        transitionStage === 'fade-out' 
          ? 'opacity-0 translate-y-4' 
          : 'opacity-100 translate-y-0'
      }`}
      onTransitionEnd={() => {
        if (transitionStage === 'fade-out') {
          setTransitionStage('fade-in');
          setDisplayLocation(location);
        }
      }}
    >
      {children}
    </div>
  );
};
