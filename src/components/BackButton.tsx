import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getBackDestination } from '@/lib/navigation';
import { useRef, useEffect } from 'react';

// Module-level previous path tracker
let previousPath: string | undefined;
let currentTrackedPath: string | undefined;

interface BackButtonProps {
  onClick?: () => void;
}

export const BackButton = ({ onClick }: BackButtonProps = {}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Track previous path
  useEffect(() => {
    if (currentTrackedPath && currentTrackedPath !== location.pathname) {
      previousPath = currentTrackedPath;
    }
    currentTrackedPath = location.pathname;
  }, [location.pathname]);

  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }
    const destination = getBackDestination(location.pathname, previousPath);
    navigate(destination);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted border border-border/50 shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
      aria-label="Go back"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
};
