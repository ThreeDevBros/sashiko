import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const useHaptics = () => {
  const isHapticsAvailable = useCallback(async () => {
    try {
      return true;
    } catch {
      return false;
    }
  }, []);

  const light = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const medium = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const heavy = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const success = useCallback(async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const warning = useCallback(async () => {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const error = useCallback(async () => {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const selectionStart = useCallback(async () => {
    try {
      await Haptics.selectionStart();
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const selectionChanged = useCallback(async () => {
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  const selectionEnd = useCallback(async () => {
    try {
      await Haptics.selectionEnd();
    } catch (error) {
      console.log('Haptics not available');
    }
  }, []);

  return {
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selectionStart,
    selectionChanged,
    selectionEnd,
    isHapticsAvailable,
  };
};
