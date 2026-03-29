import { ReactNode, MouseEvent, CSSProperties, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useEditMode } from '@/contexts/EditModeContext';

interface EditableTextProps {
  children: ReactNode;
  fieldId: string;
  fieldName: string;
  settingsId: string;
  isEditMode: boolean;
  onClick: (field: { id: string; field: string; value: string; element: HTMLElement }) => void;
  onDoubleClick?: (field: { id: string; field: string; value: string }) => void;
  className?: string;
  style?: CSSProperties;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export const EditableText = ({
  children,
  fieldId,
  fieldName,
  settingsId,
  isEditMode,
  onClick,
  onDoubleClick,
  className,
  style,
  as: Component = 'div'
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentText, setCurrentText] = useState(typeof children === 'string' ? children : '');
  const [isSelected, setIsSelected] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const { getFieldStyle, selectedField, deselectElement } = useEditMode();

  // Get dynamic styles from the context
  const dynamicStyles = getFieldStyle(settingsId, fieldName);

  // Check if this field is selected
  useEffect(() => {
    if (selectedField?.id === settingsId && selectedField?.field === fieldName) {
      setIsSelected(true);
    } else {
      setIsSelected(false);
      setIsEditing(false); // Exit editing if deselected
    }
  }, [selectedField, settingsId, fieldName]);

  // Update current text when children prop changes
  useEffect(() => {
    if (typeof children === 'string') {
      setCurrentText(children);
    } else if (children === null || children === undefined) {
      setCurrentText('');
    }
  }, [children]);

  useEffect(() => {
    if (isEditing && editableRef.current) {
      // Set the content before focusing
      if (editableRef.current.textContent !== currentText) {
        editableRef.current.textContent = currentText;
      }
      
      editableRef.current.focus();
      
      // Select all text after a small delay to ensure content is set
      setTimeout(() => {
        if (editableRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editableRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  }, [isEditing, currentText]);

  const handleClick = (e: MouseEvent) => {
    if (!isEditMode || isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsSelected(true);
    
    if (elementRef.current) {
      onClick({
        id: settingsId,
        field: fieldName,
        value: currentText,
        element: elementRef.current
      });
    }
  };

  const handleDoubleClick = (e: MouseEvent) => {
    if (!isEditMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Ensure currentText is up to date before entering edit mode
    const displayText = typeof children === 'string' ? children : currentText;
    if (displayText) {
      setCurrentText(displayText);
    }
    
    setIsEditing(true);
  };

  const handleBlur = () => {
    if (isEditing && editableRef.current && onDoubleClick) {
      const newValue = editableRef.current.textContent || '';
      if (newValue !== currentText) {
        setCurrentText(newValue);
        onDoubleClick({
          id: settingsId,
          field: fieldName,
          value: newValue
        });
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      deselectElement();
    }
  };

  if (isEditing) {
    return (
      <div
        ref={editableRef}
        contentEditable
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          className,
          "outline-none focus:ring-2 focus:ring-primary rounded px-1"
        )}
        style={{
          ...style,
          ...dynamicStyles,
          minHeight: '1em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
        suppressContentEditableWarning
      >
        {currentText}
      </div>
    );
  }

  return (
    <Component
      ref={elementRef as any}
      data-editable={isEditMode ? 'true' : 'false'}
      data-field={fieldName}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        ...style,
        ...dynamicStyles,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}
      className={cn(
        className,
        isEditMode && 'cursor-pointer hover:outline hover:outline-2 hover:outline-primary/50 hover:outline-offset-2 transition-all relative group',
        isSelected && isEditMode && 'outline outline-2 outline-primary outline-offset-2'
      )}
    >
      {currentText}
      {isEditMode && !isEditing && (
        <span className="absolute -top-6 left-0 text-xs bg-primary text-primary-foreground px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
          Click to select • Double-click to edit
        </span>
      )}
    </Component>
  );
};
