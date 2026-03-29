import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LegalContentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'terms' | 'privacy';
}

export const LegalContentSheet = ({ open, onOpenChange, type }: LegalContentSheetProps) => {
  const { data: content, isLoading } = useQuery({
    queryKey: ['legal-content', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select(type === 'terms' ? 'terms_of_service' : 'privacy_policy')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const val = type === 'terms' ? (data as any)?.terms_of_service : (data as any)?.privacy_policy;
      return val || null;
    },
    enabled: open,
  });

  const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(85vh-80px)] pr-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : content ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Content coming soon.</p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
