import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, Trash2, RefreshCw } from 'lucide-react';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  currentImageUrl?: string;
  folder?: string;
  id?: string;
}

export function ImageUpload({ onUploadComplete, onRemove, currentImageUrl, folder = 'general', id = 'image-upload' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const validateImageMagicBytes = (bytes: Uint8Array, mimeType: string): boolean => {
    // SVG files are XML text
    if (mimeType === 'image/svg+xml') {
      const text = new TextDecoder().decode(bytes.slice(0, 100));
      return text.includes('<svg') || text.includes('<?xml');
    }
    
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    // GIF: 47 49 46
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
    // WebP: 52 49 46 46
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
    // BMP: 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) return true;
    // TIFF: 49 49 or 4D 4D
    if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D)) return true;
    // ICO: 00 00 01 00
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return true;
    // AVIF: starts with specific ftyp
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true;
    // HEIC/HEIF: similar to AVIF
    if (mimeType.includes('heic') || mimeType.includes('heif')) return true;
    
    return false;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      // Validate file size (10MB max for all formats)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast({
          title: 'File too large',
          description: 'File must be less than 10MB',
          variant: 'destructive'
        });
        setUploading(false);
        return;
      }

      // Validate MIME type - support all common image formats
      const allowedTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png', 
        'image/webp', 
        'image/gif',
        'image/svg+xml',
        'image/bmp',
        'image/tiff',
        'image/x-icon',
        'image/avif',
        'image/heic',
        'image/heif'
      ];
      
      if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a valid image file (JPEG, PNG, WebP, GIF, SVG, BMP, TIFF, AVIF, HEIC)',
          variant: 'destructive'
        });
        setUploading(false);
        return;
      }

      // Validate file header (magic bytes) - check more bytes for complex formats
      const buffer = await file.slice(0, 100).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!validateImageMagicBytes(bytes, file.type)) {
        toast({
          title: 'Invalid image file',
          description: 'File does not appear to be a valid image',
          variant: 'destructive'
        });
        setUploading(false);
        return;
      }

      // Use MIME type for extension instead of trusting filename
      const ext = file.type.split('/')[1];
      const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError, data } = await supabase.storage
        .from('restaurant-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurant-images')
        .getPublicUrl(fileName);

      onUploadComplete(publicUrl);
      toast({ title: 'Image uploaded successfully' });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ 
        title: 'Upload failed', 
        description: 'Failed to upload image. Please try again with a different file.',
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentImageUrl && (
        <div className="relative w-full h-48 border rounded-lg overflow-hidden group">
          <img 
            src={currentImageUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Label htmlFor={`${id}-change`} className="cursor-pointer">
              <Button 
                type="button" 
                variant="secondary" 
                size="sm"
                className="pointer-events-none"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Change
              </Button>
            </Label>
            {onRemove && (
              <Button 
                type="button" 
                variant="destructive" 
                size="sm"
                onClick={onRemove}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <Input
            id={`${id}-change`}
            type="file"
            accept="image/*,.svg,.heic,.heif,.avif"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>
      )}
      
      {!currentImageUrl && (
        <div>
          <Label htmlFor={id} className="cursor-pointer">
            <div className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Click to upload image</span>
                </>
              )}
            </div>
          </Label>
          <Input
            id={id}
            type="file"
            accept="image/*,.svg,.heic,.heif,.avif"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
