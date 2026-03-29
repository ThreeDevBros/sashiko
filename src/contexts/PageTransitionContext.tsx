import { createContext, useContext, useState, ReactNode } from 'react';

interface TransitionPosition {
  x: number;
  y: number;
}

interface PageTransitionContextType {
  transitionPosition: TransitionPosition | null;
  setTransitionPosition: (position: TransitionPosition | null) => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

export const PageTransitionProvider = ({ children }: { children: ReactNode }) => {
  const [transitionPosition, setTransitionPosition] = useState<TransitionPosition | null>(null);

  return (
    <PageTransitionContext.Provider value={{ transitionPosition, setTransitionPosition }}>
      {children}
    </PageTransitionContext.Provider>
  );
};

export const usePageTransition = () => {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within PageTransitionProvider');
  }
  return context;
};
