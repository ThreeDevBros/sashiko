import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const GenerateMenuImages = () => {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-menu-images');

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('Generate images response:', data);

      if (data.error) {
        toast.error(data.error);
        setLastResult(`Error: ${data.error}`);
        return;
      }

      if (data.results) {
        const successful = data.results.filter((r: any) => r.success).length;
        const failed = data.results.filter((r: any) => !r.success).length;
        
        if (successful > 0) {
          toast.success(`Generated ${successful} images successfully${failed > 0 ? `, ${failed} failed` : ''}`);
        } else if (failed > 0) {
          toast.error(`Failed to generate ${failed} images`);
        }
        
        if (data.remaining > 0) {
          setLastResult(`${successful} generated, ${data.remaining} remaining. Click again to continue.`);
        } else if (data.processed === 0) {
          setLastResult('All menu items already have images!');
          toast.info('All menu items already have images');
        } else {
          setLastResult(`Done! ${successful} images generated.`);
        }
      }
    } catch (error: any) {
      console.error('Error generating images:', error);
      toast.error(error.message || 'Failed to generate images. Please try again.');
      setLastResult(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5" />
          Auto-Generate Menu Images
        </CardTitle>
        <CardDescription>
          Automatically generate AI images for menu items that don't have pictures (processes 5 at a time)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleGenerate} 
          disabled={loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating Images...
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-5 w-5" />
              Generate Missing Images
            </>
          )}
        </Button>
        {lastResult && (
          <p className="text-sm text-muted-foreground text-center">
            {lastResult}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
