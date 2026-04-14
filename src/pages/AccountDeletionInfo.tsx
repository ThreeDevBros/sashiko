import { useBranding } from '@/hooks/useBranding';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';

const AccountDeletionInfo = () => {
  const { branding } = useBranding();
  const tenantName = branding?.tenant_name || 'Sashiko';

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

        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <h2 className="text-lg font-semibold">How to Delete Your Account</h2>
          <p>
            To delete your account, open the {tenantName} app, navigate to your <strong>Profile</strong> page, 
            and tap <strong>"Proceed to Account Deletion"</strong> at the bottom of the page.
          </p>
          <p>
            You will be asked to verify your identity by entering your email address, phone number, and password 
            before proceeding with the deletion.
          </p>

          <h2 className="text-lg font-semibold mt-6">What Gets Deleted</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your personal information (name, email, phone)</li>
            <li>Order history</li>
            <li>Reservation history</li>
            <li>Saved addresses</li>
            <li>Saved payment methods</li>
            <li>Cashback / reward balance</li>
            <li>Push notification preferences</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">Important Notes</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account deletion is <strong>permanent</strong> and cannot be undone.</li>
            <li>Any remaining cashback balance will be forfeited.</li>
            <li>Active orders or reservations should be completed or cancelled before deleting your account.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">Need Help?</h2>
          <p>
            If you have any issues deleting your account, please visit our{' '}
            <a href="/support" className="text-primary underline">Support page</a>{' '}
            to contact one of our branches directly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountDeletionInfo;
