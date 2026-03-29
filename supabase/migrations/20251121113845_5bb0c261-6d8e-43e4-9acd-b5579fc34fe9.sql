-- Ensure restaurant-images storage bucket exists with proper settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images',
  true,
  10485760, -- 10MB limit
  ARRAY[
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
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete restaurant images" ON storage.objects;

-- Create RLS policies for restaurant-images bucket
CREATE POLICY "Anyone can view restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update restaurant images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete restaurant images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-images'
  AND auth.role() = 'authenticated'
);