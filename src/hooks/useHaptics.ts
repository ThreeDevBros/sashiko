import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const useHaptics = () => {
  const isHapticsAvailable = async () => {
    try {
      // Check if Haptics is available on the platform
      return true;
    } catch {
      return false;
    }
  };

  const light = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const medium = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const heavy = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const success = async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const warning = async () => {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const error = async () => {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const selectionStart = async () => {
    try {
      await Haptics.selectionStart();
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const selectionChanged = async () => {
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const selectionEnd = async () => {
    try {
      await Haptics.selectionEnd();
    } catch (error) {
      console.log('Haptics not available');
    }
  };

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
