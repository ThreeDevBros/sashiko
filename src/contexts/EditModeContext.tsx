import { createContext, useContext, ReactNode, CSSProperties, useEffect } from 'react';
import { useEditableContent, EditableField } from '@/hooks/useEditableContent';
import { TransformControls } from '@/components/admin/TransformControls';

interface EditModeContextType {
  selectedElement: HTMLElement | null;
  selectedField: { id: string; field: string } | null;
  isEditMode: boolean;
  pendingChanges: any[];
  selectElement: (field: EditableField) => void;
  saveInlineEdit: (field: { id: string; field: string; value: string }) => void;
  saveAllChanges: () => void;
  deselectElement: () => void;
  toggleEditMode: () => void;
  updateFieldStyle: (styleKey: string, value: string) => void;
  getFieldStyle: (id: string, field: string) => CSSProperties;
  isOnCooldown: boolean;
}

const EditModeContext = createContext<EditModeContextType | null>(null);

export const EditModeProvider = ({ children }: { children: ReactNode }) => {
  const editableContent = useEditableContent();

  // Handle clicking outside to deselect
  useEffect(() => {
    if (!editableContent.isEditMode) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't deselect if clicking toolbar or editable element
      if (
        target.closest('[data-editable="true"]') ||
        target.closest('.rounded-lg.border.bg-card') // toolbar
      ) {
        return;
      }
      
      editableContent.deselectElement();
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [editableContent.isEditMode, editableContent.deselectElement]);

  return (
    <EditModeContext.Provider value={editableContent}>
      {children}
      {editableContent.selectedElement && editableContent.isEditMode && (
        <TransformControls 
          element={editableContent.selectedElement}
          onTransformEnd={(transform) => {
            console.log('Transform ended:', transform);
          }}
        />
      )}
    </EditModeContext.Provider>
  );
};

export const useEditMode = () => {
  const context = useContext(EditModeContext);
  if (!context) {
    // Return a default implementation when not in edit mode
    return {
      selectedElement: null,
      selectedField: null,
      isEditMode: false,
      pendingChanges: [],
      selectElement: () => {},
      saveInlineEdit: () => {},
      saveAllChanges: () => {},
      deselectElement: () => {},
      toggleEditMode: () => {},
      updateFieldStyle: () => {},
      getFieldStyle: () => ({}),
      isOnCooldown: false
    };
  }
  return context;
};
