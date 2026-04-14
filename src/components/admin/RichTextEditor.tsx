import { useRef, useCallback, useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Undo2,
  Redo2,
  Copy,
  RemoveFormatting,
  Link,
  Unlink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const FONT_SIZES = [
  { value: '1', label: '10px' },
  { value: '2', label: '13px' },
  { value: '3', label: '16px' },
  { value: '4', label: '18px' },
  { value: '5', label: '24px' },
  { value: '6', label: '32px' },
  { value: '7', label: '48px' },
];

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff',
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db',
  '#9b59b6', '#e91e63', '#795548', '#607d8b', '#ff6b6b', '#ffa502',
];

const ToolbarButton = ({
  onClick,
  children,
  title,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  active?: boolean;
}) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={title}
    className={cn(
      'p-1.5 rounded hover:bg-muted transition-colors',
      active && 'bg-muted text-primary'
    )}
  >
    {children}
  </button>
);

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '300px',
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef<Range | null>(null);
  const initializedRef = useRef(false);

  // Set initial HTML only once
  useEffect(() => {
    if (editorRef.current && !initializedRef.current && value) {
      editorRef.current.innerHTML = value;
      initializedRef.current = true;
    }
  }, [value]);

  // Also handle when value changes externally (e.g. loading from DB)
  useEffect(() => {
    if (editorRef.current && value && !initializedRef.current) {
      editorRef.current.innerHTML = value;
      initializedRef.current = true;
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleHeading = useCallback((heading: string) => {
    editorRef.current?.focus();
    if (heading === 'p') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${heading}>`);
    }
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleFontSize = useCallback((size: string) => {
    exec('fontSize', size);
  }, [exec]);

  const handleColor = useCallback((color: string) => {
    exec('foreColor', color);
    setColorOpen(false);
  }, [exec]);

  const handleCopyFormat = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString();
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  const handleRemoveFormat = useCallback(() => {
    exec('removeFormat');
  }, [exec]);

  const handleUndo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('undo', false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleRedo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('redo', false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-input bg-muted/30">
        {/* Block format */}
        <Select onValueChange={handleHeading} defaultValue="p">
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Normal</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Font size */}
        <Select onValueChange={handleFontSize} defaultValue="3">
          <SelectTrigger className="w-[80px] h-8 text-xs">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Bold, Italic, Underline */}
        <ToolbarButton onClick={() => exec('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline">
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Text color */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Text Color"
            >
              <Palette className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-6 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => handleColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Input
                type="color"
                className="w-8 h-8 p-0 border-0 cursor-pointer"
                onChange={(e) => handleColor(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">Custom</span>
            </div>
          </PopoverContent>
        </Popover>

        {/* Copy & Remove format */}
        <ToolbarButton onClick={handleCopyFormat} title="Copy Text">
          <Copy className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleRemoveFormat} title="Remove Formatting">
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => exec('justifyLeft')} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyCenter')} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyRight')} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo / Redo */}
        <ToolbarButton onClick={handleUndo} title="Undo">
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleRedo} title="Redo">
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor area — NO dangerouslySetInnerHTML to avoid cursor reset */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="p-4 outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 2em; font-weight: bold; margin: 0.5em 0; }
        [contenteditable] h2 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        [contenteditable] h3 { font-size: 1.17em; font-weight: bold; margin: 0.5em 0; }
        [contenteditable] h4 { font-size: 1em; font-weight: bold; margin: 0.5em 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.5em; margin: 0.5em 0; }
        [contenteditable] p { margin: 0.25em 0; }
      `}</style>
    </div>
  );
};
