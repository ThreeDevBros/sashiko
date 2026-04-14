import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/hooks/useBranding';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';

const AccountDeletionInfo = () => {
  const { branding } = useBranding();
  const tenantName = branding?.tenant_name || 'Sashiko';

  const { data: content, isLoading } = useQuery({
    queryKey: ['account-deletion-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('account_deletion_info')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.account_deletion_info || null;
    },
  });

  const defaultContent = `
    <h2>How to Delete Your Account</h2>
    <p>To delete your account, open the ${tenantName} app, navigate to your <strong>Profile</strong> page, and tap <strong>"Proceed to Account Deletion"</strong> at the bottom of the page.</p>
    <p>You will be asked to verify your identity by entering your email address, phone number, and password before proceeding with the deletion.</p>
    <h2>What Gets Deleted</h2>
    <ul>
      <li>Your personal information (name, email, phone)</li>
      <li>Order history</li>
      <li>Reservation history</li>
      <li>Saved addresses</li>
      <li>Saved payment methods</li>
      <li>Cashback / reward balance</li>
      <li>Push notification preferences</li>
    </ul>
    <h2>Important Notes</h2>
    <ul>
      <li>Account deletion is <strong>permanent</strong> and cannot be undone.</li>
      <li>Any remaining cashback balance will be forfeited.</li>
      <li>Active orders or reservations should be completed or cancelled before deleting your account.</li>
    </ul>
    <h2>Need Help?</h2>
    <p>If you have any issues deleting your account, please visit our <a href="/support">Support page</a> to contact one of our branches directly.</p>
  `;

  const displayContent = content || defaultContent;

  return (
    <div className="min-h-screen bg-background pt-safe px-4 pb-8">
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto p-3 rounded-full bg-destructive/10 w-fit">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Account Deletion</h1>
          <p className="text-muted-foreground text-sm">
            Information about deleting your {tenantName} account
          </p>
        </div>

        <Separator />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3"
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        )}
      </div>
    </div>
  );
};

export default AccountDeletionInfo;
