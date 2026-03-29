import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseRateLimitedActionOptions {
  cooldownMs?: number;
  cooldownMessage?: string;
}

export const useRateLimitedAction = (options: UseRateLimitedActionOptions = {}) => {
  const {
    cooldownMs = 5000,
    cooldownMessage = "Please wait before saving again"
  } = options;
  
  const { toast } = useToast();
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const lastActionTime = useRef<number>(0);

  const executeAction = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTime.current;

    if (timeSinceLastAction < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastAction) / 1000);
      toast({
        title: "Too fast!",
        description: `${cooldownMessage} (${remainingSeconds}s remaining)`,
        variant: "destructive"
      });
      return null;
    }

    setIsOnCooldown(true);
    lastActionTime.current = now;

    try {
      const result = await action();
      
      // Keep cooldown active for the full duration
      setTimeout(() => {
        setIsOnCooldown(false);
      }, cooldownMs);
      
      return result;
    } catch (error) {
      // Reset cooldown on error so user can try again
      setIsOnCooldown(false);
      lastActionTime.current = 0;
      throw error;
    }
  }, [cooldownMs, cooldownMessage, toast]);

  return { executeAction, isOnCooldown };
};

