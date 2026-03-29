import { Button } from '@/components/ui/button';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Type, 
  Image as ImageIcon, 
  Square, 
  Palette,
  Plus
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEditMode } from '@/contexts/EditModeContext';

export const CustomizationToolbar = () => {
  const { selectedField, updateFieldStyle } = useEditMode();

  const applyAlignment = (alignment: string) => {
    updateFieldStyle('textAlign', alignment);
  };

  const applyFont = (font: string) => {
    updateFieldStyle('fontFamily', font);
  };

  const applyFontSize = (size: string) => {
    updateFieldStyle('fontSize', `${size}px`);
  };

  const applyColor = (color: string) => {
    updateFieldStyle('color', color);
  };

  const applyBackgroundColor = (color: string) => {
    updateFieldStyle('backgroundColor', color);
  };

  return (
    <div className="rounded-lg border bg-card p-4 mb-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Alignment Controls */}
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground mr-2">Align:</Label>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => applyAlignment('left')}
            disabled={!selectedField}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => applyAlignment('center')}
            disabled={!selectedField}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => applyAlignment('right')}
            disabled={!selectedField}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => applyAlignment('justify')}
            disabled={!selectedField}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Font Controls */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Font:</Label>
          <Select 
            defaultValue="inter"
            onValueChange={applyFont}
            disabled={!selectedField}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Roboto">Roboto</SelectItem>
              <SelectItem value="Playfair Display">Playfair Display</SelectItem>
              <SelectItem value="Montserrat">Montserrat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Size:</Label>
          <Select 
            defaultValue="16"
            onValueChange={applyFontSize}
            disabled={!selectedField}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12px</SelectItem>
              <SelectItem value="14">14px</SelectItem>
              <SelectItem value="16">16px</SelectItem>
              <SelectItem value="18">18px</SelectItem>
              <SelectItem value="20">20px</SelectItem>
              <SelectItem value="24">24px</SelectItem>
              <SelectItem value="32">32px</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Color Controls */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Color:</Label>
          <div className="flex items-center gap-1">
            <Input 
              type="color" 
              defaultValue="#f97316" 
              className="h-8 w-12 p-1 cursor-pointer"
              onChange={(e) => applyColor(e.target.value)}
              disabled={!selectedField}
            />
            <Palette className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Background Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">BG:</Label>
          <div className="flex items-center gap-1">
            <Input 
              type="color" 
              defaultValue="#ffffff" 
              className="h-8 w-12 p-1 cursor-pointer"
              onChange={(e) => applyBackgroundColor(e.target.value)}
              disabled={!selectedField}
            />
            <Square className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Add Elements */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Add:</Label>
          <Button variant="outline" size="sm" className="h-8">
            <Type className="h-4 w-4 mr-1" />
            Text
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="h-4 w-4 mr-1" />
            Button
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <ImageIcon className="h-4 w-4 mr-1" />
            Image
          </Button>
        </div>
      </div>
    </div>
  );
};
