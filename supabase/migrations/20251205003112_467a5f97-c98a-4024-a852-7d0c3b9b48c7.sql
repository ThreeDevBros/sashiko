-- Create storage bucket for restaurant images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public read access
CREATE POLICY "Public read access for restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

-- Create policy to allow service role to upload
CREATE POLICY "Service role can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurant-images');

-- Create policy to allow service role to update
CREATE POLICY "Service role can update restaurant images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurant-images');

-- Create policy to allow service role to delete
CREATE POLICY "Service role can delete restaurant images"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-images');