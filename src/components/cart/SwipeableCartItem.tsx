import { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Edit3, Minus, Plus, PenLine, ListChecks } from "lucide-react";
import { CartItem } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/currency';
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SwipeableCartItemProps {
  item: CartItem;
  onDelete: () => void;
  onEdit: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateNote?: (note: string) => void;
  currency?: string;
}

export const SwipeableCartItem = ({ 
  item, 
  onDelete, 
  onEdit, 
  onUpdateQuantity,
  onUpdateNote,
  currency = 'USD' 
}: SwipeableCartItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState<'left' | 'right' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemHeight, setItemHeight] = useState<number | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(item.special_instructions || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMoved = useRef(false);

  const ACTION_THRESHOLD = 40;
  const OPEN_POSITION = 70;
  const editTriggeredRef = useRef(false);

  const hasNote = !!item.special_instructions;
  const hasModifiers = item.selectedModifiers && item.selectedModifiers.length > 0;

  // Fetch modifier names for display
  const { data: modifierNames } = useQuery({
    queryKey: ['modifier-names', item.selectedModifiers],
    queryFn: async () => {
      if (!item.selectedModifiers?.length) return [];
      const { data } = await supabase
        .from('modifiers')
        .select('id, name')
        .in('id', item.selectedModifiers);
      return data?.map(m => m.name) || [];
    },
    enabled: !!hasModifiers,
    staleTime: Infinity,
  });

  // Capture initial height
  useEffect(() => {
    if (containerRef.current && itemHeight === null) {
      setItemHeight(containerRef.current.offsetHeight);
    }
  }, [itemHeight]);

  // Reset height when note input toggles
  useEffect(() => {
    setItemHeight(null);
  }, [showNoteInput]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleting) return;
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
    hasMoved.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isDeleting) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    let newTranslateX = diff;
    if (isOpen === 'right') newTranslateX = OPEN_POSITION + diff;
    else if (isOpen === 'left') newTranslateX = -OPEN_POSITION + diff;
    newTranslateX = Math.max(-OPEN_POSITION, Math.min(OPEN_POSITION, newTranslateX));
    setTranslateX(newTranslateX);
    if (Math.abs(diff) > 5) hasMoved.current = true;
  };

  const handleTouchEnd = () => {
    if (isDeleting) return;
    isDraggingRef.current = false;
    if (translateX > ACTION_THRESHOLD) { setTranslateX(OPEN_POSITION); setIsOpen('right'); }
    else if (translateX < -ACTION_THRESHOLD && !editTriggeredRef.current) {
      editTriggeredRef.current = true;
      setTranslateX(0);
      setIsOpen(null);
      onEdit();
    }
    else { setTranslateX(0); setIsOpen(null); }
    editTriggeredRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDeleting) return;
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
    hasMoved.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || isDeleting) return;
    const currentX = e.clientX;
    const diff = currentX - startXRef.current;
    let newTranslateX = diff;
    if (isOpen === 'right') newTranslateX = OPEN_POSITION + diff;
    else if (isOpen === 'left') newTranslateX = -OPEN_POSITION + diff;
    newTranslateX = Math.max(-OPEN_POSITION, Math.min(OPEN_POSITION, newTranslateX));
    setTranslateX(newTranslateX);
    if (Math.abs(diff) > 5) hasMoved.current = true;
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current || isDeleting) return;
    isDraggingRef.current = false;
    if (translateX > ACTION_THRESHOLD) { setTranslateX(OPEN_POSITION); setIsOpen('right'); }
    else if (translateX < -ACTION_THRESHOLD && !editTriggeredRef.current) {
      editTriggeredRef.current = true;
      setTranslateX(0);
      setIsOpen(null);
      onEdit();
    }
    else { setTranslateX(0); setIsOpen(null); }
    editTriggeredRef.current = false;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (containerRef.current) setItemHeight(containerRef.current.offsetHeight);
    setIsDeleting(true);
    setTranslateX(400);
    setTimeout(() => onDelete(), 350);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTranslateX(0);
    setIsOpen(null);
    onEdit();
  };

  const handleCardClick = () => {
    if (isDeleting) return;
    if (!hasMoved.current && isOpen) {
      setTranslateX(0);
      setIsOpen(null);
    }
  };

  const handleNoteSave = () => {
    onUpdateNote?.(noteText.trim());
    setShowNoteInput(false);
  };

  const showExtension = (hasModifiers && modifierNames && modifierNames.length > 0) || hasNote;

  return (
    <div 
      ref={containerRef}
      className="relative rounded-2xl"
      style={{
        height: isDeleting ? 0 : (itemHeight ? itemHeight : 'auto'),
        overflow: 'hidden',
        marginBottom: isDeleting ? -12 : 0,
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting 
          ? 'height 0.3s ease-out, margin-bottom 0.3s ease-out, opacity 0.25s ease-out' 
          : 'none',
      }}
    >
      {/* Delete action (left side - revealed on swipe right) */}
      <div 
        className="absolute inset-0 bg-destructive rounded-2xl flex items-center justify-start pl-5"
        style={{ 
          opacity: translateX > 0 ? Math.min(translateX / OPEN_POSITION, 1) : 0,
          pointerEvents: isOpen === 'right' ? 'auto' : 'none',
          zIndex: 0,
        }}
        onClick={handleDelete}
      >
        <Trash2 className="h-6 w-6 text-destructive-foreground" />
      </div>

      {/* Edit action (right side - revealed on swipe left) */}
      <div 
        className="absolute inset-0 bg-primary rounded-2xl flex items-center justify-end pr-5"
        style={{ 
          opacity: translateX < 0 ? Math.min(Math.abs(translateX) / OPEN_POSITION, 1) : 0,
          pointerEvents: isOpen === 'left' ? 'auto' : 'none',
          zIndex: 0,
        }}
        onClick={handleEdit}
      >
        <Edit3 className="h-6 w-6 text-primary-foreground" />
      </div>

      {/* Main card */}
      <div
        ref={itemRef}
        className="relative cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease-out',
          zIndex: 1,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCardClick}
      >
        <Card className={`border-2 border-border rounded-2xl ${showExtension ? 'rounded-b-none border-b-0' : ''}`}>
          <div className="flex gap-3 p-3">
            {item.image_url && (
              <img 
                src={item.image_url} 
                alt={item.name}
                className="w-16 h-16 object-cover rounded-lg pointer-events-none shrink-0"
                draggable={false}
              />
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(item.price, currency)}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(Math.max(0, item.quantity - 1));
                  }}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                
                <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item.quantity + 1);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold text-sm">
                {formatCurrency(item.price * item.quantity, currency)}
              </p>
            </div>
          </div>
        </Card>

        {/* Extension for modifiers & instructions */}
        {showExtension && (
          <div className="border-2 border-t-0 border-border rounded-b-2xl bg-muted/30 px-3 py-2 space-y-1">
            {hasModifiers && modifierNames && modifierNames.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs">
                <ListChecks className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{modifierNames.join(', ')}</span>
              </div>
            )}
            {hasNote && (
              <div className="flex items-start gap-1.5 text-xs">
                <PenLine className="h-3 w-3 text-primary fill-primary/20 mt-0.5 shrink-0" />
                <span className="text-primary">{item.special_instructions}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
