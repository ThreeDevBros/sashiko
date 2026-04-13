import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS, APP_CONFIG } from '@/constants';
import type { Branch } from '@/types';

/**
 * Fetch branch by ID or first active branch.
 * Throws on network errors so React Query can retry.
 */
export const fetchBranch = async (branchId?: string, signal?: AbortSignal): Promise<Branch | null> => {
  if (branchId) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .eq('id', branchId)
      .abortSignal(signal!)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .abortSignal(signal!)
      .limit(1);
    
    if (error) throw error;
    return data?.[0] || null;
  }
};

/**
 * Fetch branch by ID, falling back to the first active branch if the ID is stale/invalid.
 * Throws on network errors so React Query can retry.
 */
export const fetchBranchWithFallback = async (savedBranchId?: string | null): Promise<Branch | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    if (savedBranchId) {
      const branch = await fetchBranch(savedBranchId, controller.signal);
      if (branch) return branch;
      console.warn('[branch] Saved branch ID is stale, falling back to first active branch');
      localStorage.removeItem(STORAGE_KEYS.SELECTED_BRANCH);
    }
    return await fetchBranch(undefined, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Get cached branch data from localStorage
 */
export const getCachedBranch = (): Branch | null => {
  try {
    const raw = localStorage.getItem('cached-branch-data');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.name) return parsed as Branch;
    return null;
  } catch {
    return null;
  }
};

/**
 * Cache branch data to localStorage
 */
export const cacheBranchData = (branch: Branch): void => {
  try {
    localStorage.setItem('cached-branch-data', JSON.stringify(branch));
  } catch {}
};

/**
 * Get saved branch ID from localStorage
 */
export const getSavedBranchId = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_BRANCH);
};

/**
 * Save branch ID to localStorage
 */
export const saveBranchId = (branchId: string): void => {
  localStorage.setItem(STORAGE_KEYS.SELECTED_BRANCH, branchId);
};

/**
 * Calculate estimated delivery time based on order queue
 */
export const calculateEstimatedTime = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'preparing']);

    if (error) throw error;

    const additionalTime = (count || 0) * APP_CONFIG.ESTIMATED_TIME_PER_ORDER;
    return Math.min(
      APP_CONFIG.ESTIMATED_TIME_BASE + additionalTime,
      APP_CONFIG.ESTIMATED_TIME_MAX
    );
  } catch (error) {
    console.error('Error calculating estimated time:', error);
    return APP_CONFIG.ESTIMATED_TIME_BASE;
  }
};

/**
 * Dispatch branch changed event
 */
export const dispatchBranchChanged = (): void => {
  window.dispatchEvent(new Event('branchChanged'));
};

/**
 * Parse a time string (HH:MM, HH:MM:SS, or HH:MM:SS±TZ) into total minutes.
 */
const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(/[+-]\d{2}(:\d{2})?$/, '').trim();
  const parts = cleaned.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
};

/**
 * Format a time string for display (HH:MM without seconds).
 */
export const formatBranchTime = (timeStr: string | null): string => {
  if (!timeStr) return '';
  const cleaned = timeStr.replace(/[+-]\d{2}(:\d{2})?$/, '').trim();
  const parts = cleaned.split(':');
  if (parts.length < 2) return timeStr;
  return `${parts[0]}:${parts[1]}`;
};

/**
 * Check if a branch is currently open based on its operating hours.
 */
export const isBranchOpen = (opensAt: string | null, closesAt: string | null): boolean => {
  if (!opensAt || !closesAt) return true;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const openMinutes = parseTimeToMinutes(opensAt);
  const closeMinutes = parseTimeToMinutes(closesAt);
  
  if (openMinutes === null || closeMinutes === null) {
    console.warn('Could not parse branch hours:', { opensAt, closesAt });
    return true;
  }
  
  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
  
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};
