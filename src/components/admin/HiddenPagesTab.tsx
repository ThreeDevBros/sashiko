import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { FileText, ShieldCheck, Cookie, Copy, ExternalLink, ChevronDown, ChevronUp, Phone, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HiddenPagesTabProps {
  tenantId: string | undefined;
  termsOfService: string;
  setTermsOfService: (v: string) => void;
  privacyPolicy: string;
  setPrivacyPolicy: (v: string) => void;
  cookiesDataUsage: string;
  setCookiesDataUsage: (v: string) => void;
  isLoading: boolean;
}

export const HiddenPagesTab = ({
  tenantId,
  termsOfService,
  setTermsOfService,
  privacyPolicy,
  setPrivacyPolicy,
  cookiesDataUsage,
  setCookiesDataUsage,
  isLoading,
}: HiddenPagesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openSection, setOpenSection] = useState<string | null>('terms');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    queryClient.invalidateQueries({ queryKey: ['legal-content'] });
  };

  const saveTermsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ terms_of_service: termsOfService || null } as any)
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Terms of Service saved' }); },
    onError: (e: any) => { toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }); },
  });

  const savePrivacyMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ privacy_policy: privacyPolicy || null } as any)
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Privacy Policy saved' }); },
    onError: (e: any) => { toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }); },
  });

  const saveCookiesMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant settings found');
      const { error } = await supabase
        .from('tenant_settings')
        .update({ cookies_data_usage: cookiesDataUsage || null } as any)
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Cookies & Data Usage saved' }); },
    onError: (e: any) => { toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }); },
  });

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: `${label} URL copied to clipboard.` });
  };

  const sections = [
    {
      id: 'terms',
      icon: FileText,
      title: 'Terms of Service',
      description: 'Write and manage your Terms of Service content.',
      value: termsOfService,
      onChange: setTermsOfService,
      mutation: saveTermsMutation,
      url: 'https://sashikoasianfusion.com/legal/terms',
      urlLabel: 'sashikoasianfusion.com/legal/terms',
    },
    {
      id: 'privacy',
      icon: ShieldCheck,
      title: 'Privacy Policy',
      description: 'Write and manage your Privacy Policy content.',
      value: privacyPolicy,
      onChange: setPrivacyPolicy,
      mutation: savePrivacyMutation,
      url: 'https://sashikoasianfusion.com/legal/privacy',
      urlLabel: 'sashikoasianfusion.com/legal/privacy',
    },
    {
      id: 'cookies',
      icon: Cookie,
      title: 'Cookies & Data Usage',
      description: 'Write and manage your Cookies & Data Usage content.',
      value: cookiesDataUsage,
      onChange: setCookiesDataUsage,
      mutation: saveCookiesMutation,
      url: 'https://sashikoasianfusion.com/legal/cookies',
      urlLabel: 'sashikoasianfusion.com/legal/cookies',
    },
  ];

  const urlOnlyPages = [
    {
      id: 'support',
      icon: Phone,
      title: 'Support Page',
      description: 'Auto-generated page showing branch contact details.',
      url: 'https://sashikoasianfusion.com/support',
      urlLabel: 'sashikoasianfusion.com/support',
    },
    {
      id: 'account-deletion',
      icon: UserX,
      title: 'Account Deletion Info',
      description: 'Information page about how to delete an account and what data gets removed.',
      url: 'https://sashikoasianfusion.com/account-deletion-info',
      urlLabel: 'sashikoasianfusion.com/account-deletion-info',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These pages are publicly accessible but not prominently linked in the app. Edit their content below.
      </p>
      {sections.map((section) => {
        const Icon = section.icon;
        const isOpen = openSection === section.id;
        return (
          <Collapsible key={section.id} open={isOpen} onOpenChange={(open) => setOpenSection(open ? section.id : null)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      <Icon className="w-5 h-5 text-primary" />
                      {section.title}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <RichTextEditor
                    value={section.value}
                    onChange={section.onChange}
                    placeholder={`Enter your ${section.title} content here...`}
                    minHeight="300px"
                  />
                  <Button
                    onClick={() => section.mutation.mutate()}
                    disabled={section.mutation.isPending || isLoading}
                  >
                    {section.mutation.isPending ? 'Saving...' : `Save ${section.title}`}
                  </Button>
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={section.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">
                      {section.urlLabel}
                    </a>
                    <Button variant="outline" size="sm" className="shrink-0 ml-auto" onClick={() => copyUrl(section.url, section.title)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy URL
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {urlOnlyPages.map((page) => {
        const Icon = page.icon;
        return (
          <Card key={page.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="w-5 h-5 text-primary" />
                {page.title}
              </CardTitle>
              <CardDescription>{page.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate">
                  {page.urlLabel}
                </a>
                <Button variant="outline" size="sm" className="shrink-0 ml-auto" onClick={() => copyUrl(page.url, page.title)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy URL
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
