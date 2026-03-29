import { useState, useCallback, CSSProperties } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction';

export interface EditableField {
  id: string;
  field: string;
  value: string;
  element?: HTMLElement;
}

interface PendingChange {
  id: string;
  field: string;
  value: string;
}

interface FieldStyle {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

interface SelectedField {
  id: string;
  field: string;
}

export const useEditableContent = () => {
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [selectedField, setSelectedField] = useState<SelectedField | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [fieldStyles, setFieldStyles] = useState<Record<string, FieldStyle>>({});
  const { toast } = useToast();
  const { executeAction, isOnCooldown } = useRateLimitedAction({
    cooldownMs: 5000,
    cooldownMessage: "Please wait before saving again"
  });

  const selectElement = useCallback((field: EditableField) => {
    if (field.element) {
      setSelectedElement(field.element);
      setSelectedField({ id: field.id, field: field.field });
    }
  }, []);

  const updateFieldStyle = useCallback((styleKey: keyof FieldStyle, value: string) => {
    if (!selectedField) return;
    
    const fieldKey = `${selectedField.id}-${selectedField.field}`;
    setFieldStyles(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        [styleKey]: value
      }
    }));
  }, [selectedField]);

  const getFieldStyle = useCallback((id: string, field: string): CSSProperties => {
    const fieldKey = `${id}-${field}`;
    return fieldStyles[fieldKey] || {};
  }, [fieldStyles]);

  const saveInlineEdit = useCallback((field: { id: string; field: string; value: string }) => {
    // Store the change locally without saving to DB
    setPendingChanges(prev => {
      const filtered = prev.filter(
        change => !(change.id === field.id && change.field === field.field)
      );
      return [...filtered, { id: field.id, field: field.field, value: field.value }];
    });
  }, []);

  const saveAllChanges = useCallback(async () => {
    if (pendingChanges.length === 0) {
      toast({
        title: "No changes",
        description: "There are no pending changes to save."
      });
      return;
    }

    await executeAction(async () => {
      // Group changes by id
      const changesByRecord: Record<string, Record<string, string>> = {};
      pendingChanges.forEach(change => {
        if (!changesByRecord[change.id]) {
          changesByRecord[change.id] = {};
        }
        changesByRecord[change.id][change.field] = change.value;
      });

      // Save each record
      for (const [id, updates] of Object.entries(changesByRecord)) {
        const { error } = await supabase
          .from('tenant_settings')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }

      toast({
        title: "Changes published",
        description: "All changes have been saved successfully."
      });

      setPendingChanges([]);
      
      // Force a page reload to reflect changes
      window.location.reload();
    });
  }, [pendingChanges, toast, executeAction]);

  const deselectElement = useCallback(() => {
    setSelectedElement(null);
    setSelectedField(null);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
    setSelectedElement(null);
    setSelectedField(null);
  }, []);

  return {
    selectedElement,
    selectedField,
    isEditMode,
    pendingChanges,
    selectElement,
    saveInlineEdit,
    saveAllChanges,
    deselectElement,
    toggleEditMode,
    updateFieldStyle,
    getFieldStyle,
    isOnCooldown
  };
};
