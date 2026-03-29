import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Save, Plus, Trash2, ZoomIn, ZoomOut, RotateCw, Layers, ChevronDown, Crosshair } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableObject } from '@/components/layout/TableObject';
import { generateChairsForShape, snapChairToEllipse } from '@/lib/chairLayout';
import { QuickEditDialog } from '@/components/admin/QuickEditDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface Chair {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

interface LayoutObject {
  id: string;
  type: 'table' | 'bar' | 'barstool' | 'window' | 'exit' | 'plant' | 'kitchen' | 'wc' | 'wall' | 'elevator' | 'stairs';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  rotation?: number;
  seats?: number;
  shape?: 'rectangle' | 'circle' | 'square';
  chairSides?: { top?: number; right?: number; bottom?: number; left?: number };
  chairs?: Chair[];
}

interface FloorData {
  id: string;
  name: string;
  objects: LayoutObject[];
}

const ROTATION_SNAP = 45;
const ROTATION_SNAP_THRESHOLD = 5;
const ALIGNMENT_THRESHOLD = 10;

// Reliable touch event detection that works with both native and React synthetic events
const isTouchEvent = (e: any): e is TouchEvent => {
  return e.touches !== undefined && e.touches !== null && typeof e.touches.length === 'number' && e.touches.length > 0;
};

const getClientPos = (e: any): { clientX: number; clientY: number } => {
  if (isTouchEvent(e)) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
};

const softSnapRotation = (rotation: number) => {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const nearestSnap = Math.round(normalizedRotation / ROTATION_SNAP) * ROTATION_SNAP;
  const distanceToSnap = Math.abs(normalizedRotation - nearestSnap);
  if (distanceToSnap < ROTATION_SNAP_THRESHOLD) {
    return nearestSnap;
  }
  return normalizedRotation;
};

const findAlignmentSnap = (
  currentObj: LayoutObject,
  allObjects: LayoutObject[],
  proposedX: number,
  proposedY: number,
  snapEnabled: boolean
): { x: number; y: number; snapLines: Array<{ type: 'vertical' | 'horizontal'; position: number }> } => {
  if (!snapEnabled) {
    return { x: proposedX, y: proposedY, snapLines: [] };
  }

  let snappedX = proposedX;
  let snappedY = proposedY;
  let minXDist = ALIGNMENT_THRESHOLD;
  let minYDist = ALIGNMENT_THRESHOLD;
  const snapLines: Array<{ type: 'vertical' | 'horizontal'; position: number }> = [];

  const currentRight = proposedX + currentObj.width;
  const currentBottom = proposedY + currentObj.height;
  const currentCenterX = proposedX + currentObj.width / 2;
  const currentCenterY = proposedY + currentObj.height / 2;

  allObjects.forEach(obj => {
    if (obj.id === currentObj.id) return;

    const objRight = obj.x + obj.width;
    const objBottom = obj.y + obj.height;
    const objCenterX = obj.x + obj.width / 2;
    const objCenterY = obj.y + obj.height / 2;

    const leftDist = Math.abs(proposedX - obj.x);
    const rightDist = Math.abs(currentRight - objRight);
    const leftToRightDist = Math.abs(proposedX - objRight);
    const rightToLeftDist = Math.abs(currentRight - obj.x);
    const centerXDist = Math.abs(currentCenterX - objCenterX);

    if (leftDist < minXDist) { snappedX = obj.x; minXDist = leftDist; snapLines.length = 0; snapLines.push({ type: 'vertical', position: obj.x }); }
    if (rightDist < minXDist) { snappedX = objRight - currentObj.width; minXDist = rightDist; snapLines.length = 0; snapLines.push({ type: 'vertical', position: objRight }); }
    if (leftToRightDist < minXDist) { snappedX = objRight; minXDist = leftToRightDist; snapLines.length = 0; snapLines.push({ type: 'vertical', position: objRight }); }
    if (rightToLeftDist < minXDist) { snappedX = obj.x - currentObj.width; minXDist = rightToLeftDist; snapLines.length = 0; snapLines.push({ type: 'vertical', position: obj.x }); }
    if (centerXDist < minXDist) { snappedX = objCenterX - currentObj.width / 2; minXDist = centerXDist; snapLines.length = 0; snapLines.push({ type: 'vertical', position: objCenterX }); }

    const topDist = Math.abs(proposedY - obj.y);
    const bottomDist = Math.abs(currentBottom - objBottom);
    const topToBottomDist = Math.abs(proposedY - objBottom);
    const bottomToTopDist = Math.abs(currentBottom - obj.y);
    const centerYDist = Math.abs(currentCenterY - objCenterY);

    if (topDist < minYDist) { snappedY = obj.y; minYDist = topDist; if (snapLines[0]?.type === 'vertical') snapLines.push({ type: 'horizontal', position: obj.y }); else { snapLines.length = 0; snapLines.push({ type: 'horizontal', position: obj.y }); } }
    if (bottomDist < minYDist) { snappedY = objBottom - currentObj.height; minYDist = bottomDist; if (snapLines[0]?.type === 'vertical') snapLines.push({ type: 'horizontal', position: objBottom }); else { snapLines.length = 0; snapLines.push({ type: 'horizontal', position: objBottom }); } }
    if (topToBottomDist < minYDist) { snappedY = objBottom; minYDist = topToBottomDist; if (snapLines[0]?.type === 'vertical') snapLines.push({ type: 'horizontal', position: objBottom }); else { snapLines.length = 0; snapLines.push({ type: 'horizontal', position: objBottom }); } }
    if (bottomToTopDist < minYDist) { snappedY = obj.y - currentObj.height; minYDist = bottomToTopDist; if (snapLines[0]?.type === 'vertical') snapLines.push({ type: 'horizontal', position: obj.y }); else { snapLines.length = 0; snapLines.push({ type: 'horizontal', position: obj.y }); } }
    if (centerYDist < minYDist) { snappedY = objCenterY - currentObj.height / 2; minYDist = centerYDist; if (snapLines[0]?.type === 'vertical') snapLines.push({ type: 'horizontal', position: objCenterY }); else { snapLines.length = 0; snapLines.push({ type: 'horizontal', position: objCenterY }); } }
  });

  return { x: snappedX, y: snappedY, snapLines };
};

// Generate properly aligned chairs
const generateChairs = (shape: string, seats: number, width: number, height: number): Chair[] => {
  return generateChairsForShape(shape, seats, width, height);
};

interface BranchLayoutDesignerProps {
  initialBranchId?: string;
  onClose?: () => void;
}

const CANVAS_SIZE = 1600;
const MIN_EDITOR_ZOOM = 0.15;
const MAX_EDITOR_ZOOM = 3;

export default function BranchLayoutDesigner({ initialBranchId, onClose }: BranchLayoutDesignerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || '');
  const [objects, setObjects] = useState<LayoutObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedChairId, setSelectedChairId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingChair, setIsDraggingChair] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [objectStart, setObjectStart] = useState({ x: 0, y: 0, width: 0, height: 0, rotation: 0 });
  const [chairStart, setChairStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateCenter, setRotateCenter] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapLines, setSnapLines] = useState<Array<{ type: 'vertical' | 'horizontal'; position: number }>>([]);
  const [originalChairs, setOriginalChairs] = useState<Chair[]>([]);

  // Refs to avoid stale closures in mouse/touch handlers
  const isDraggingRef = useRef(false);
  const isDraggingChairRef = useRef(false);
  const isResizingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const selectedObjectIdRef = useRef<string | null>(null);
  const selectedChairIdRef = useRef<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const objectStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, rotation: 0 });
  const chairStartRef = useRef({ x: 0, y: 0 });
  const resizeHandleRef = useRef<'se' | 'sw' | 'ne' | 'nw' | null>(null);
  const rotateCenterRef = useRef({ x: 0, y: 0 });
  const originalChairsRef = useRef<Chair[]>([]);

  // Pan/zoom refs for map navigation (mirrors FloorPlanCanvas)
  const isPanningMapRef = useRef(false);
  const panMovedRef = useRef(false);
  const panStartMapRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.5);

  // Multi-floor state
  const [floors, setFloors] = useState<FloorData[]>([{ id: 'floor-1', name: 'Ground Floor', objects: [] }]);
  const [activeFloorId, setActiveFloorId] = useState('floor-1');
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches-layout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: branchData } = useQuery({
    queryKey: ['branch-layout', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return null;
      const { data, error } = await supabase
        .from('branches')
        .select('layout_data')
        .eq('id', selectedBranchId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBranchId,
  });

  // Regenerate chairs for all table types to ensure bounds/selection work correctly
  const migrateObjectChairs = (obj: any) => {
    const migrated = { ...obj, type: obj.type === 'toilet' ? 'wc' : obj.type };
    if (migrated.type === 'table' && migrated.seats) {
      if (!migrated.chairs || migrated.chairs.length === 0 || migrated.shape === 'circle') {
        migrated.chairs = generateChairs(migrated.shape || 'rectangle', migrated.seats, migrated.width, migrated.height);
      }
    }
    return migrated;
  };

  // Load layout data - support both old (single floor) and new (multi-floor) format
  useEffect(() => {
    if (branchData?.layout_data && typeof branchData.layout_data === 'object') {
      const ld = branchData.layout_data as any;
      if (ld.floors && Array.isArray(ld.floors)) {
        const migratedFloors = ld.floors.map((f: FloorData) => ({
          ...f,
          objects: (f.objects || []).map(migrateObjectChairs)
        }));
        setFloors(migratedFloors);
        setActiveFloorId(migratedFloors[0]?.id || 'floor-1');
        setObjects(migratedFloors[0]?.objects || []);
      } else if (ld.objects) {
        const migratedObjects = (ld.objects as any[]).map(migrateObjectChairs);
        const defaultFloor: FloorData = { id: 'floor-1', name: 'Ground Floor', objects: migratedObjects };
        setFloors([defaultFloor]);
        setActiveFloorId('floor-1');
        setObjects(migratedObjects);
      } else {
        setFloors([{ id: 'floor-1', name: 'Ground Floor', objects: [] }]);
        setActiveFloorId('floor-1');
        setObjects([]);
      }
    } else {
      setFloors([{ id: 'floor-1', name: 'Ground Floor', objects: [] }]);
      setActiveFloorId('floor-1');
      setObjects([]);
    }
  }, [branchData]);

  // Sync objects to active floor
  useEffect(() => {
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, objects } : f));
  }, [objects, activeFloorId]);

  const switchFloor = (floorId: string) => {
    // Save current floor's objects
    setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, objects } : f));
    setActiveFloorId(floorId);
    const floor = floors.find(f => f.id === floorId);
    setObjects(floor?.objects || []);
    setSelectedObjectId(null);
    setSelectedChairId(null);
  };

  const addFloor = () => {
    if (!newFloorName.trim()) return;
    const newFloor: FloorData = {
      id: `floor-${Date.now()}`,
      name: newFloorName.trim(),
      objects: []
    };
    // Save current floor first
    setFloors(prev => [...prev.map(f => f.id === activeFloorId ? { ...f, objects } : f), newFloor]);
    setActiveFloorId(newFloor.id);
    setObjects([]);
    setNewFloorName('');
    setIsAddingFloor(false);
    setSelectedObjectId(null);
  };

  const deleteFloor = (floorId: string) => {
    if (floors.length <= 1) return;
    const remaining = floors.filter(f => f.id !== floorId);
    setFloors(remaining);
    if (activeFloorId === floorId) {
      setActiveFloorId(remaining[0].id);
      setObjects(remaining[0].objects);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranchId) throw new Error('No branch selected');
      // Save current floor's objects
      const updatedFloors = floors.map(f => f.id === activeFloorId ? { ...f, objects } : f);
      const { error } = await supabase
        .from('branches')
        .update({ layout_data: { floors: updatedFloors } as any })
        .eq('id', selectedBranchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-layout', selectedBranchId] });
      toast({ title: 'Layout saved successfully' });
    },
  });

  const addObject = (type: LayoutObject['type']) => {
    const getDefaultSize = () => {
      switch (type) {
        case 'table': return { width: 80, height: 80 };
        case 'bar': return { width: 120, height: 80 };
        case 'barstool': return { width: 40, height: 40 };
        case 'kitchen': return { width: 150, height: 100 };
        case 'wc': return { width: 80, height: 80 };
        case 'elevator': return { width: 80, height: 80 };
        case 'stairs': return { width: 100, height: 60 };
        default: return { width: 80, height: 80 };
      }
    };

    const size = getDefaultSize();
    const defaultSeats = type === 'table' ? 4 : undefined;
    const defaultShape: 'rectangle' | 'circle' | 'square' = 'rectangle';

    const newObject: LayoutObject = {
      id: `${type}-${Date.now()}`,
      type,
      x: 100,
      y: 100,
      width: size.width,
      height: size.height,
      rotation: 0,
      seats: defaultSeats,
      shape: defaultShape,
      chairs: type === 'table' ? generateChairs(defaultShape, 4, size.width, size.height) : undefined,
    };
    setObjects([...objects, newObject]);
  };

  const deleteObject = (id: string) => {
    setObjects(objects.filter(obj => obj.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  const updateObject = (updates: Partial<LayoutObject>) => {
    if (!selectedObjectId) return;
    setObjects(objects.map(obj =>
      obj.id === selectedObjectId ? { ...obj, ...updates } : obj
    ));
  };

  const handleDoubleClick = (objectId: string) => {
    setSelectedObjectId(objectId);
    setEditDialogOpen(true);
  };

  const handleQuickEdit = (label: string, shape: 'rectangle' | 'circle' | 'square', seats?: number) => {
    const object = objects.find(obj => obj.id === selectedObjectId);
    if (!object) return;

    const updates: Partial<LayoutObject> = { label, shape };

    if (seats !== undefined) {
      updates.seats = seats;
      updates.chairs = generateChairs(shape, seats, object.width, object.height);
    }

    updateObject(updates);
  };

  const handleRotateMouseDown = (e: React.MouseEvent | React.TouchEvent, objectId: string) => {
    e.stopPropagation();
    if (isTouchEvent(e.nativeEvent || e)) e.preventDefault();
    const object = objects.find(obj => obj.id === objectId);
    if (!object) return;
    const { clientX, clientY } = getClientPos(e.nativeEvent || e);
    setSelectedObjectId(objectId);
    selectedObjectIdRef.current = objectId;
    setIsRotating(true);
    isRotatingRef.current = true;
    if (object.chairs) {
      setOriginalChairs([...object.chairs]);
      originalChairsRef.current = [...object.chairs];
    }
    const container = canvasContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + panRef.current.x + (object.x + object.width / 2) * zoomRef.current;
    const centerY = containerRect.top + panRef.current.y + (object.y + object.height / 2) * zoomRef.current;
    setRotateCenter({ x: centerX, y: centerY });
    rotateCenterRef.current = { x: centerX, y: centerY };
    const initialAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    setDragStart({ x: initialAngle, y: object.rotation || 0 });
    dragStartRef.current = { x: initialAngle, y: object.rotation || 0 };
    objectStartRef.current = { x: object.x, y: object.y, width: object.width, height: object.height, rotation: object.rotation || 0 };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, objectId: string, handle?: 'se' | 'sw' | 'ne' | 'nw') => {
    e.stopPropagation();
    if (isTouchEvent(e.nativeEvent || e)) e.preventDefault();
    const object = objects.find(obj => obj.id === objectId);
    if (!object) return;
    const { clientX, clientY } = getClientPos(e.nativeEvent || e);
    setSelectedObjectId(objectId);
    selectedObjectIdRef.current = objectId;
    setSelectedChairId(null);
    selectedChairIdRef.current = null;
    const start = { x: clientX, y: clientY };
    setDragStart(start);
    dragStartRef.current = start;
    const objStart = { x: object.x, y: object.y, width: object.width, height: object.height, rotation: object.rotation || 0 };
    setObjectStart(objStart);
    objectStartRef.current = objStart;
    if (handle) {
      setIsResizing(true); setResizeHandle(handle);
      isResizingRef.current = true; resizeHandleRef.current = handle;
    } else {
      setIsDragging(true);
      isDraggingRef.current = true;
    }
  };

  const handleChairMouseDown = (e: React.MouseEvent | React.TouchEvent, objectId: string, chairId: string) => {
    e.stopPropagation();
    if (isTouchEvent(e.nativeEvent || e)) e.preventDefault();
    const object = objects.find(obj => obj.id === objectId);
    if (!object || !object.chairs) return;
    const chair = object.chairs.find(c => c.id === chairId);
    if (!chair) return;
    const { clientX, clientY } = getClientPos(e.nativeEvent || e);
    setSelectedObjectId(objectId);
    selectedObjectIdRef.current = objectId;
    setSelectedChairId(chairId);
    selectedChairIdRef.current = chairId;
    const start = { x: clientX, y: clientY };
    setDragStart(start);
    dragStartRef.current = start;
    const cStart = { x: chair.x, y: chair.y };
    setChairStart(cStart);
    chairStartRef.current = cStart;
    setIsDraggingChair(true);
    isDraggingChairRef.current = true;
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const objId = selectedObjectIdRef.current;
    const dragging = isDraggingRef.current;
    const draggingChair = isDraggingChairRef.current;
    const resizing = isResizingRef.current;
    const rotating = isRotatingRef.current;

    if (!objId || (!dragging && !resizing && !draggingChair && !rotating)) return;
    if ('cancelable' in e && e.cancelable) e.preventDefault();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const { clientX, clientY } = getClientPos(e);

    animationFrameRef.current = requestAnimationFrame(() => {
      const ds = dragStartRef.current;
      const os = objectStartRef.current;
      const cs = chairStartRef.current;
      const rh = resizeHandleRef.current;
      const rc = rotateCenterRef.current;
      const oc = originalChairsRef.current;
      const chairId = selectedChairIdRef.current;

      const deltaX = (clientX - ds.x) / zoom;
      const deltaY = (clientY - ds.y) / zoom;

      if (rotating) {
        const dx = clientX - rc.x;
        const dy = clientY - rc.y;
        const angle = Math.atan2(dy, dx);
        const degrees = ((angle * 180 / Math.PI + 90) % 360 + 360) % 360;
        const snappedRotation = softSnapRotation(degrees);

        setObjects(prevObjects =>
          prevObjects.map(obj => {
            if (obj.id === objId) {
              // Only update the rotation angle - chairs stay in local positions
              // The parent div's CSS transform handles visual rotation of everything
              return { ...obj, rotation: snappedRotation };
            }
            return obj;
          })
        );
      } else if (draggingChair && chairId) {
        let newX = cs.x + deltaX;
        let newY = cs.y + deltaY;
        setObjects(prevObjects => {
          const parentObject = prevObjects.find(obj => obj.id === objId);
          if (parentObject) {
            const chairSize = 16;
            const snapDistance = 30;
            const tableEdgeOffset = chairSize + 4;

            if (parentObject.shape === 'circle') {
              const snapped = snapChairToEllipse(newX, newY, parentObject.width, parentObject.height);
              return prevObjects.map(obj =>
                obj.id === objId && obj.chairs
                  ? { ...obj, chairs: obj.chairs.map(chair => chair.id === chairId ? { ...chair, x: snapped.x, y: snapped.y, rotation: snapped.rotation } : chair) }
                  : obj
              );
            } else {
              const distToTop = Math.abs(newY - (-tableEdgeOffset));
              const distToBottom = Math.abs(newY - (parentObject.height + 4));
              const distToLeft = Math.abs(newX - (-tableEdgeOffset));
              const distToRight = Math.abs(newX - (parentObject.width + 4));
              const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
              if (minDist < snapDistance) {
                if (minDist === distToTop) { newY = -tableEdgeOffset; newX = Math.max(0, Math.min(parentObject.width - chairSize, newX)); }
                else if (minDist === distToBottom) { newY = parentObject.height + 4; newX = Math.max(0, Math.min(parentObject.width - chairSize, newX)); }
                else if (minDist === distToLeft) { newX = -tableEdgeOffset; newY = Math.max(0, Math.min(parentObject.height - chairSize, newY)); }
                else { newX = parentObject.width + 4; newY = Math.max(0, Math.min(parentObject.height - chairSize, newY)); }
              }
            }
          }
          return prevObjects.map(obj =>
            obj.id === objId && obj.chairs
              ? { ...obj, chairs: obj.chairs.map(chair => chair.id === chairId ? { ...chair, x: newX, y: newY } : chair) }
              : obj
          );
        });
      } else if (dragging) {
        const proposedX = Math.max(0, os.x + deltaX);
        const proposedY = Math.max(0, os.y + deltaY);
        setObjects(prevObjects => {
          const selectedObject = prevObjects.find(obj => obj.id === objId);
          if (!selectedObject) return prevObjects;
          const result = findAlignmentSnap(selectedObject, prevObjects, proposedX, proposedY, snapEnabled);
          setSnapLines(result.snapLines);
          return prevObjects.map(obj => obj.id === objId ? { ...obj, x: result.x, y: result.y } : obj);
        });
      } else if (resizing && rh) {
        let newWidth = os.width, newHeight = os.height, newX = os.x, newY = os.y;
        switch (rh) {
          case 'se': newWidth = Math.max(20, os.width + deltaX); newHeight = Math.max(20, os.height + deltaY); break;
          case 'sw': newWidth = Math.max(20, os.width - deltaX); newHeight = Math.max(20, os.height + deltaY); newX = os.x + (os.width - newWidth); break;
          case 'ne': newWidth = Math.max(20, os.width + deltaX); newHeight = Math.max(20, os.height - deltaY); newY = os.y + (os.height - newHeight); break;
          case 'nw': newWidth = Math.max(20, os.width - deltaX); newHeight = Math.max(20, os.height - deltaY); newX = os.x + (os.width - newWidth); newY = os.y + (os.height - newHeight); break;
        }
        setObjects(prevObjects => prevObjects.map(obj => {
          if (obj.id === objId) {
            const updated = { ...obj, width: newWidth, height: newHeight, x: newX, y: newY };
            if (obj.chairs && obj.chairs.length > 0 && obj.type === 'table') {
              updated.chairs = generateChairs(obj.shape || 'rectangle', obj.chairs.length, newWidth, newHeight);
            }
            return updated;
          }
          return obj;
        }));
      }
    });
  }, [zoom, snapEnabled]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingChair(false);
    setIsResizing(false);
    setIsRotating(false);
    setResizeHandle(null);
    setSnapLines([]);
    setOriginalChairs([]);
    isDraggingRef.current = false;
    isDraggingChairRef.current = false;
    isResizingRef.current = false;
    isRotatingRef.current = false;
    resizeHandleRef.current = null;
    originalChairsRef.current = [];
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Keep zoom/pan refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Document-level listeners for object drag/resize/rotate
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if ((isDraggingRef.current || isDraggingChairRef.current || isResizingRef.current || isRotatingRef.current) && e.cancelable) {
        e.preventDefault();
      }
      handleMouseMove(e);
    };
    const onTouchEnd = () => handleMouseUp();
    const onMouseMoveDoc = (e: MouseEvent) => handleMouseMove(e);
    const onMouseUpDoc = () => handleMouseUp();

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mousemove', onMouseMoveDoc);
    document.addEventListener('mouseup', onMouseUpDoc);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mousemove', onMouseMoveDoc);
      document.removeEventListener('mouseup', onMouseUpDoc);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Map pan/zoom handlers (mirrors FloorPlanCanvas) ───────────────

  const onMapMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanningMapRef.current = true;
    panMovedRef.current = false;
    panStartMapRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
  }, []);

  const onMapMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningMapRef.current) return;
    panMovedRef.current = true;
    setPan({
      x: panStartMapRef.current.panX + (e.clientX - panStartMapRef.current.x),
      y: panStartMapRef.current.panY + (e.clientY - panStartMapRef.current.y),
    });
  }, []);

  const onMapMouseUp = useCallback(() => {
    isPanningMapRef.current = false;
  }, []);

  // Zoom centered on viewport center (for toolbar buttons)
  const handleZoomButton = useCallback((direction: 'in' | 'out') => {
    const vp = canvasContainerRef.current;
    if (!vp) return;
    const prev = zoomRef.current;
    const next = direction === 'in'
      ? Math.min(MAX_EDITOR_ZOOM, prev + 0.1)
      : Math.max(MIN_EDITOR_ZOOM, prev - 0.1);
    const mx = vp.clientWidth / 2;
    const my = vp.clientHeight / 2;
    setZoom(next);
    setPan({
      x: mx - (mx - panRef.current.x) * (next / prev),
      y: my - (my - panRef.current.y) * (next / prev),
    });
  }, []);

  // Wheel zoom centered on cursor
  useEffect(() => {
    const vp = canvasContainerRef.current;
    if (!vp) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prev = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      const next = Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, prev * factor));
      setZoom(next);
      setPan({
        x: mx - (mx - panRef.current.x) * (next / prev),
        y: my - (my - panRef.current.y) * (next / prev),
      });
    };
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, []);

  // Touch: pinch zoom + one-finger pan on empty space
  useEffect(() => {
    const vp = canvasContainerRef.current;
    if (!vp) return;
    const isObjInteracting = () =>
      isDraggingRef.current || isDraggingChairRef.current || isResizingRef.current || isRotatingRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      if (isObjInteracting()) return;
      const target = e.target as HTMLElement;
      if (!target.classList.contains('canvas-background') && target !== vp) return;

      if (e.touches.length >= 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartRef.current = { dist: Math.hypot(dx, dy), zoom: zoomRef.current };
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        panStartMapRef.current = { x: midX, y: midY, panX: panRef.current.x, panY: panRef.current.y };
      } else if (e.touches.length === 1) {
        e.preventDefault();
        isPanningMapRef.current = true;
        panMovedRef.current = false;
        panStartMapRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: panRef.current.x, panY: panRef.current.y };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isObjInteracting()) return;
      if (e.touches.length >= 2 && pinchStartRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newZoom = Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist)));
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setZoom(newZoom);
        setPan({
          x: panStartMapRef.current.panX + (midX - panStartMapRef.current.x),
          y: panStartMapRef.current.panY + (midY - panStartMapRef.current.y),
        });
      } else if (e.touches.length === 1 && isPanningMapRef.current) {
        e.preventDefault();
        panMovedRef.current = true;
        setPan({
          x: panStartMapRef.current.panX + (e.touches[0].clientX - panStartMapRef.current.x),
          y: panStartMapRef.current.panY + (e.touches[0].clientY - panStartMapRef.current.y),
        });
      }
    };

    const handleTouchEnd = () => {
      pinchStartRef.current = null;
      isPanningMapRef.current = false;
    };

    vp.addEventListener('touchstart', handleTouchStart, { passive: false });
    vp.addEventListener('touchmove', handleTouchMove, { passive: false });
    vp.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      vp.removeEventListener('touchstart', handleTouchStart);
      vp.removeEventListener('touchmove', handleTouchMove);
      vp.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Calculate bounding box that includes chairs for selection outline
  // Uses the EXACT same chair placement logic as TableObject
  const getObjectBounds = (obj: LayoutObject) => {
    const padding = 6;
    if (obj.type !== 'table') {
      return { offsetX: -padding, offsetY: -padding, totalWidth: obj.width + padding * 2, totalHeight: obj.height + padding * 2 };
    }

    const CS = 18;
    const GAP = 4;
    const CIRCLE_GAP = 2;
    const w = obj.width;
    const h = obj.height;
    const seats = obj.seats || 4;
    const isCircle = obj.shape === 'circle';
    const hasCustomChairs = obj.chairs && obj.chairs.length > 0;

    // Collect all chair positions (top-left corner of each chair)
    const chairPositions: { x: number; y: number }[] = [];

    if (hasCustomChairs) {
      obj.chairs!.forEach(c => chairPositions.push({ x: c.x, y: c.y }));
    } else if (isCircle) {
      const a = w / 2, b = h / 2;
      const offset = CS / 2 + CIRCLE_GAP;
      for (let i = 0; i < seats; i++) {
        const angle = (i / seats) * 2 * Math.PI - Math.PI / 2;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const ex = a * cosA, ey = b * sinA;
        const nx = cosA / a, ny = sinA / b;
        const nLen = Math.sqrt(nx * nx + ny * ny);
        chairPositions.push({
          x: a + ex + (nx / nLen) * offset - CS / 2,
          y: b + ey + (ny / nLen) * offset - CS / 2,
        });
      }
    } else {
      // Replicate TableObject's getRectChairPositions exactly
      const isWide = w >= h;
      if (seats <= 2) {
        if (isWide) {
          chairPositions.push({ x: w / 2 - CS / 2, y: -CS - GAP });
          if (seats === 2) chairPositions.push({ x: w / 2 - CS / 2, y: h + GAP });
        } else {
          chairPositions.push({ x: -CS - GAP, y: h / 2 - CS / 2 });
          if (seats === 2) chairPositions.push({ x: w + GAP, y: h / 2 - CS / 2 });
        }
      } else {
        let topS = 0, bottomS = 0, leftS = 0, rightS = 0;
        if (obj.chairSides) {
          topS = obj.chairSides.top || 0;
          rightS = obj.chairSides.right || 0;
          bottomS = obj.chairSides.bottom || 0;
          leftS = obj.chairSides.left || 0;
        } else if (isWide) {
          const longSeats = seats <= 4 ? seats : seats - 2;
          topS = Math.ceil(longSeats / 2);
          bottomS = Math.floor(longSeats / 2);
          if (seats > 4) { leftS = 1; rightS = 1; }
        } else {
          const longSeats = seats <= 4 ? seats : seats - 2;
          leftS = Math.ceil(longSeats / 2);
          rightS = Math.floor(longSeats / 2);
          if (seats > 4) { topS = 1; bottomS = 1; }
        }
        for (let i = 0; i < topS; i++) chairPositions.push({ x: ((i + 1) * w) / (topS + 1) - CS / 2, y: -CS - GAP });
        for (let i = 0; i < rightS; i++) chairPositions.push({ x: w + GAP, y: ((i + 1) * h) / (rightS + 1) - CS / 2 });
        for (let i = 0; i < bottomS; i++) chairPositions.push({ x: ((i + 1) * w) / (bottomS + 1) - CS / 2, y: h + GAP });
        for (let i = 0; i < leftS; i++) chairPositions.push({ x: -CS - GAP, y: ((i + 1) * h) / (leftS + 1) - CS / 2 });
      }
    }

    // Compute tight bounding box from actual positions
    let minX = 0, minY = 0, maxX = w, maxY = h;
    chairPositions.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CS);
      maxY = Math.max(maxY, p.y + CS);
    });

    // Force symmetry around table center
    const centerX = w / 2, centerY = h / 2;
    const halfW = Math.max(centerX - minX, maxX - centerX);
    const halfH = Math.max(centerY - minY, maxY - centerY);

    return {
      offsetX: centerX - halfW - padding,
      // Keep vertical bounds centered around the object/chairs (no upward bias)
      offsetY: centerY - halfH - padding,
      totalWidth: halfW * 2 + padding * 2,
      totalHeight: halfH * 2 + padding * 2,
    };
  };

  const objectToolbar: { type: LayoutObject['type']; label: string }[] = [
    { type: 'table', label: 'Table' },
    { type: 'bar', label: 'Bar' },
    { type: 'barstool', label: 'Bar Stool' },
    { type: 'window', label: 'Window' },
    { type: 'exit', label: 'Exit' },
    { type: 'plant', label: 'Plant' },
    { type: 'kitchen', label: 'Kitchen' },
    { type: 'wc', label: 'WC' },
    { type: 'wall', label: 'Wall' },
    { type: 'elevator', label: 'Elevator' },
    { type: 'stairs', label: 'Stairs' },
  ];

  const activeFloor = floors.find(f => f.id === activeFloorId);

  const content = (
    <div className="space-y-4 p-4">
      {!onClose && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Branch Layout Designer</h1>
            <p className="text-muted-foreground">Design your restaurant floor plan</p>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={!selectedBranchId || saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>Close</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="order-2 lg:order-1">
          <Card>
            <CardContent className="pt-4">
              {!initialBranchId && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Branch</label>
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} - {branch.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedBranchId && (
                <>
                  {/* Object toolbar */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {objectToolbar.map(({ type, label }) => (
                      <Button key={type} size="sm" onClick={() => addObject(type)} variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        {label}
                      </Button>
                    ))}
                  </div>

                  {/* Zoom, Snap & Floor controls */}
                  <div className="flex gap-2 mb-4 items-center flex-wrap">
                    <Button size="sm" onClick={() => handleZoomButton('in')} variant="outline">
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleZoomButton('out')} variant="outline">
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm py-2 px-3 bg-muted rounded">{Math.round(zoom * 100)}%</span>
                    <Button size="sm" onClick={() => { setZoom(0.5); setPan({ x: 0, y: 0 }); }} variant="outline" title="Recenter layout">
                      <Crosshair className="w-4 h-4" />
                    </Button>

                    <div className="h-6 w-px bg-border mx-2" />

                    <Button
                      size="sm"
                      onClick={() => setSnapEnabled(!snapEnabled)}
                      variant={snapEnabled ? "default" : "outline"}
                      title={snapEnabled ? "Snapping Enabled" : "Snapping Disabled"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                        <line x1="12" y1="2" x2="12" y2="6"/>
                        <line x1="12" y1="18" x2="12" y2="22"/>
                        <line x1="2" y1="12" x2="6" y2="12"/>
                        <line x1="18" y1="12" x2="22" y2="12"/>
                      </svg>
                      Snap
                    </Button>

                    <div className="h-6 w-px bg-border mx-2" />

                    {/* Floors dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Layers className="w-4 h-4 mr-2" />
                          {activeFloor?.name || 'Floor'}
                          <ChevronDown className="w-3 h-3 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[200px] z-[10001]">
                        {floors.map(floor => (
                          <DropdownMenuItem
                            key={floor.id}
                            onClick={() => switchFloor(floor.id)}
                            className={floor.id === activeFloorId ? 'bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground' : ''}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{floor.name}</span>
                              {floors.length > 1 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 ml-2"
                                  onClick={(e) => { e.stopPropagation(); deleteFloor(floor.id); }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {isAddingFloor ? (
                          <div className="p-2 flex gap-2" onClick={e => e.stopPropagation()}>
                            <Input
                              placeholder="Floor name"
                              value={newFloorName}
                              onChange={(e) => setNewFloorName(e.target.value)}
                              className="h-8 text-sm"
                              onKeyDown={(e) => { if (e.key === 'Enter') addFloor(); }}
                              autoFocus
                            />
                            <Button size="sm" className="h-8" onClick={addFloor}>Add</Button>
                          </div>
                        ) : (
                          <DropdownMenuItem onClick={() => setIsAddingFloor(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Floor
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Canvas - much larger */}
                  <div
                    ref={canvasContainerRef}
                    className="relative border-2 border-dashed border-muted rounded-lg bg-muted/10 overflow-hidden select-none"
                    style={{
                      height: onClose ? '65vh' : '70vh',
                      maxHeight: '800px',
                      cursor: isPanningMapRef.current ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      overscrollBehavior: 'contain',
                      backgroundImage: 'radial-gradient(circle, hsl(var(--muted)) 1px, transparent 1px)',
                      backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                      backgroundPosition: `${pan.x}px ${pan.y}px`,
                    }}
                    onMouseDown={onMapMouseDown}
                    onMouseMove={onMapMouseMove}
                    onMouseUp={onMapMouseUp}
                    onMouseLeave={onMapMouseUp}
                    onClick={(e) => {
                      if (panMovedRef.current) { panMovedRef.current = false; return; }
                      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.canvas-background')) {
                        setSelectedObjectId(null);
                        setSelectedChairId(null);
                      }
                    }}
                  >
                    <div
                      className="relative canvas-background"
                      style={{
                        position: 'absolute',
                        width: `${CANVAS_SIZE}px`,
                        height: `${CANVAS_SIZE}px`,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                      }}
                      onClick={(e) => {
                        if (panMovedRef.current) return;
                        if (e.target === e.currentTarget) {
                          setSelectedObjectId(null);
                          setSelectedChairId(null);
                        }
                      }}
                    >
                      {objects.map((obj) => {
                        const bounds = getObjectBounds(obj);
                        const isSelected = selectedObjectId === obj.id;
                        return (
                        <div key={obj.id}>
                          <div
                            className={`absolute cursor-move transition-shadow ${
                              isSelected ? 'shadow-xl z-10' : 'shadow-md'
                            }`}
                            style={{
                              left: `${obj.x}px`,
                              top: `${obj.y}px`,
                              width: `${obj.width}px`,
                              height: `${obj.height}px`,
                              transform: `rotate(${obj.rotation || 0}deg)`,
                              overflow: 'visible',
                            }}
                            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, obj.id); }}
                            onTouchStart={(e) => { e.stopPropagation(); handleMouseDown(e, obj.id); }}
                            onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(obj.id); }}
                            onClick={(e) => { e.stopPropagation(); }}
                          >
                            <TableObject
                              type={obj.type}
                              width={obj.width}
                              height={obj.height}
                              seats={obj.seats}
                              shape={obj.shape}
                              zoom={1}
                              chairSides={obj.chairSides}
                              chairs={obj.chairs}
                              isDesigner={true}
                            />
                            {/* Selection border - in outer div coordinate space */}
                            {isSelected && (
                              <div
                                className="absolute pointer-events-none z-[5]"
                                style={{
                                  left: `${bounds.offsetX}px`,
                                  top: `${bounds.offsetY}px`,
                                  width: `${bounds.totalWidth}px`,
                                  height: `${bounds.totalHeight}px`,
                                  border: '3px solid #22c55e',
                                  borderRadius: '8px',
                                  boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.3)',
                                }}
                              />
                            )}
                            {isSelected && (
                              <>
                                {/* Rotate handle - positioned above the bounding box top */}
                                <div
                                  className="absolute w-6 h-6 bg-primary rounded-full cursor-pointer z-20 flex items-center justify-center hover:scale-110 transition-transform"
                                  style={{
                                    left: `${obj.width / 2 - 12}px`,
                                    top: `${bounds.offsetY - 28}px`,
                                  }}
                                  onMouseDown={(e) => handleRotateMouseDown(e, obj.id)}
                                  onTouchStart={(e) => handleRotateMouseDown(e, obj.id)}
                                  title="Drag to rotate"
                                >
                                  <RotateCw className="h-3 w-3 text-primary-foreground" />
                                </div>
                                {/* Delete button - top right of bounding box */}
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="absolute h-6 w-6 z-20"
                                  style={{
                                    left: `${bounds.offsetX + bounds.totalWidth + 2}px`,
                                    top: `${bounds.offsetY - 2}px`,
                                  }}
                                  onClick={(e) => { e.stopPropagation(); deleteObject(obj.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                {/* Resize handles at bounding box corners (scaled) */}
                                <div className="absolute w-3 h-3 bg-primary rounded-full cursor-se-resize z-20" style={{ left: `${bounds.offsetX + bounds.totalWidth - 6}px`, top: `${bounds.offsetY + bounds.totalHeight - 6}px` }} onMouseDown={(e) => handleMouseDown(e, obj.id, 'se')} onTouchStart={(e) => handleMouseDown(e, obj.id, 'se')} />
                                <div className="absolute w-3 h-3 bg-primary rounded-full cursor-sw-resize z-20" style={{ left: `${bounds.offsetX - 6}px`, top: `${bounds.offsetY + bounds.totalHeight - 6}px` }} onMouseDown={(e) => handleMouseDown(e, obj.id, 'sw')} onTouchStart={(e) => handleMouseDown(e, obj.id, 'sw')} />
                                <div className="absolute w-3 h-3 bg-primary rounded-full cursor-ne-resize z-20" style={{ left: `${bounds.offsetX + bounds.totalWidth - 6}px`, top: `${bounds.offsetY - 6}px` }} onMouseDown={(e) => handleMouseDown(e, obj.id, 'ne')} onTouchStart={(e) => handleMouseDown(e, obj.id, 'ne')} />
                                <div className="absolute w-3 h-3 bg-primary rounded-full cursor-nw-resize z-20" style={{ left: `${bounds.offsetX - 6}px`, top: `${bounds.offsetY - 6}px` }} onMouseDown={(e) => handleMouseDown(e, obj.id, 'nw')} onTouchStart={(e) => handleMouseDown(e, obj.id, 'nw')} />
                              </>
                            )}
                          </div>

                          {/* Draggable chair hit-areas */}
                          {obj.type === 'table' && obj.chairs && obj.chairs.map((chair) => (
                              <div
                                key={chair.id}
                                className={`absolute rounded-full ${selectedChairId === chair.id ? 'ring-2 ring-primary' : ''}`}
                                style={{
                                  left: `${obj.x + chair.x}px`,
                                  top: `${obj.y + chair.y}px`,
                                  width: '18px',
                                  height: '18px',
                                  transform: `rotate(${chair.rotation}deg)`,
                                  cursor: 'move',
                                  zIndex: 30,
                                  pointerEvents: 'auto',
                                  background: selectedChairId === chair.id ? 'hsl(var(--primary)/0.15)' : 'transparent',
                                }}
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleChairMouseDown(e, obj.id, chair.id); }}
                                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleChairMouseDown(e, obj.id, chair.id); }}
                              />
                          ))}
                        </div>
                        );
                      })}

                      {/* Snap lines */}
                      {snapLines.map((line, index) => (
                        <div
                          key={`snap-line-${index}`}
                          className="absolute pointer-events-none"
                          style={{
                            ...(line.type === 'vertical'
                              ? { left: `${line.position}px`, top: 0, width: '2px', height: '100%' }
                              : { left: 0, top: `${line.position}px`, width: '100%', height: '2px' }),
                            backgroundColor: 'hsl(var(--primary))',
                            opacity: 0.6,
                            zIndex: 50,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-muted-foreground">
                    <p><strong>Objects:</strong> Drag to move, use corner handles to resize. <strong>Chairs:</strong> Click to select, drag to reposition.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedObjectId && (
        <QuickEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          label={objects.find(obj => obj.id === selectedObjectId)?.label || ''}
          shape={objects.find(obj => obj.id === selectedObjectId)?.shape || 'rectangle'}
          type={objects.find(obj => obj.id === selectedObjectId)?.type || 'object'}
          seats={objects.find(obj => obj.id === selectedObjectId)?.seats}
          onSave={handleQuickEdit}
        />
      )}
    </div>
  );

  return onClose ? content : <AdminLayout>{content}</AdminLayout>;
}
