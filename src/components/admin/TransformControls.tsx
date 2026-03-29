import { useEffect, useState, useRef, useCallback } from 'react';
import { RotateCw } from 'lucide-react';

interface TransformControlsProps {
  element: HTMLElement;
  onTransformEnd?: (transform: TransformState) => void;
}

export interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export const TransformControls = ({ element, onTransformEnd }: TransformControlsProps) => {
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 }); // Offset from cursor to element origin
  const initialTransform = useRef<TransformState | null>(null);

  useEffect(() => {
    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      setBounds(rect);
      
      const computedStyle = window.getComputedStyle(element);
      const matrix = new DOMMatrix(computedStyle.transform);
      const rotation = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
      
      setTransform({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        rotation: rotation
      });
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds);

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds);
    };
  }, [element]);

  const handleMouseDown = useCallback((e: React.MouseEvent, action: 'drag' | 'resize' | 'rotate', corner?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Ensure element is positioned absolutely before any transformation
    if (element.style.position !== 'absolute') {
      const rect = element.getBoundingClientRect();
      element.style.position = 'absolute';
      element.style.left = `${rect.left + window.scrollX}px`;
      element.style.top = `${rect.top + window.scrollY}px`;
      element.style.width = `${rect.width}px`;
      element.style.margin = '0';
      element.style.zIndex = '100';
    }
    
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    // Store the offset between cursor and element's top-left corner
    if (action === 'drag') {
      const rect = element.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    
    initialTransform.current = { ...transform };

    if (action === 'drag') {
      setIsDragging(true);
    } else if (action === 'resize') {
      setIsResizing(corner || 'se');
    } else if (action === 'rotate') {
      setIsRotating(true);
    }
  }, [transform, element]);

  useEffect(() => {
    let animationFrameId: number;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!initialTransform.current) return;

      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Use requestAnimationFrame for smooth rendering
      animationFrameId = requestAnimationFrame(() => {
        if (isDragging) {
          // Calculate new position based on cursor position minus the offset
          // No need to add scrollX/scrollY since we're working with clientX/clientY
          const newX = e.clientX - dragOffset.current.x;
          const newY = e.clientY - dragOffset.current.y;
          
          // Direct DOM manipulation for instant response
          element.style.position = 'fixed'; // Use fixed for smooth cursor tracking
          element.style.left = `${newX}px`;
          element.style.top = `${newY}px`;
          element.style.willChange = 'left, top';
          
          // Update bounds for visual feedback
          const rect = element.getBoundingClientRect();
          setBounds(rect);
        } else if (isResizing) {
          const deltaX = e.clientX - dragStartPos.current.x;
          const deltaY = e.clientY - dragStartPos.current.y;
          
          const newWidth = Math.max(50, initialTransform.current!.width + (
            isResizing.includes('e') ? deltaX : isResizing.includes('w') ? -deltaX : 0
          ));
          const newHeight = Math.max(30, initialTransform.current!.height + (
            isResizing.includes('s') ? deltaY : isResizing.includes('n') ? -deltaY : 0
          ));
          
          element.style.width = `${newWidth}px`;
          element.style.height = `${newHeight}px`;
          element.style.willChange = 'width, height';
          
          if (isResizing.includes('w')) {
            const newX = initialTransform.current!.x + deltaX;
            element.style.left = `${newX}px`;
          } else if (isResizing.includes('n')) {
            const newY = initialTransform.current!.y + deltaY;
            element.style.top = `${newY}px`;
          }
          
          const rect = element.getBoundingClientRect();
          setBounds(rect);
        } else if (isRotating && bounds) {
          const deltaX = e.clientX - dragStartPos.current.x;
          const deltaY = e.clientY - dragStartPos.current.y;
          
          const centerX = initialTransform.current!.x + initialTransform.current!.width / 2;
          const centerY = initialTransform.current!.y + initialTransform.current!.height / 2;
          
          const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
          
          element.style.transform = `rotate(${angle}deg)`;
          element.style.willChange = 'transform';
          
          const rect = element.getBoundingClientRect();
          setBounds(rect);
        }
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Convert fixed position back to absolute with scroll offset when dragging ends
      if (isDragging) {
        const rect = element.getBoundingClientRect();
        element.style.position = 'absolute';
        element.style.left = `${rect.left + window.scrollX}px`;
        element.style.top = `${rect.top + window.scrollY}px`;
      }
      
      // Remove willChange to free up resources
      element.style.willChange = 'auto';
      
      if ((isDragging || isResizing || isRotating) && onTransformEnd) {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        const matrix = new DOMMatrix(computedStyle.transform);
        const rotation = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
        
        onTransformEnd({
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          rotation: rotation
        });
      }
      
      setIsDragging(false);
      setIsResizing(null);
      setIsRotating(false);
      initialTransform.current = null;
    };

    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, isRotating, bounds, element, onTransformEnd]);

  if (!bounds) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: `${bounds.left}px`,
        top: `${bounds.top + 28}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      }}
    >
      {/* Outline with shadow for better visibility */}
      <div className="absolute inset-0 border-2 border-green-500 rounded pointer-events-none shadow-[0_0_0_2px_rgba(34,197,94,0.2)]" />
      
      {/* Semi-transparent overlay to show selection */}
      <div className="absolute inset-0 bg-green-500/5 pointer-events-none rounded" />
      
      {/* Draggable area */}
      <div
        className="absolute inset-0 cursor-move pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'drag')}
      />

      {/* Resize handles */}
      <div
        className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nw-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')}
      />
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-n-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'n')}
      />
      <div
        className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-ne-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -right-1 w-3 h-3 bg-primary rounded-full cursor-e-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'e')}
      />
      <div
        className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-se-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')}
      />
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-s-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 's')}
      />
      <div
        className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-sw-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-primary rounded-full cursor-w-resize pointer-events-auto"
        onMouseDown={(e) => handleMouseDown(e, 'resize', 'w')}
      />

      {/* Rotate handle */}
      <div
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center"
        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
      >
        <RotateCw className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-primary pointer-events-none" />
    </div>
  );
};
