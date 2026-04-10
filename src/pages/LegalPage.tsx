import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BackButton } from '@/components/BackButton';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/hooks/useBranding';

export default function LegalPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const isTerms = type === 'terms';
  const isCookies = type === 'cookies';
  const title = isTerms ? 'Terms of Service' : isCookies ? 'Cookies & Data Usage' : 'Privacy Policy';
  const tenantName = branding?.tenant_name || 'Sashiko';
  const currentYear = new Date().getFullYear();

  const { data: content, isLoading } = useQuery({
    queryKey: ['legal-content', type],
    queryFn: async () => {
      const field = isTerms ? 'terms_of_service' : isCookies ? 'cookies_data_usage' : 'privacy_policy';
      const { data, error } = await supabase
        .from('tenant_settings')
        .select(field)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.[field] || null;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : content ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Content coming soon.</p>
        )}

        {/* Footer with divider, legal links, and copyright */}
        <div className="mt-12 pb-8">
          <Separator className="mb-6" />
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => navigate('/legal/terms')}
              className={`text-sm transition-colors ${type === 'terms' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => navigate('/legal/privacy')}
              className={`text-sm transition-colors ${type === 'privacy' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => navigate('/legal/cookies')}
              className={`text-sm transition-colors ${type === 'cookies' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Cookies & Data Usage
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {tenantName} © {currentYear}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
