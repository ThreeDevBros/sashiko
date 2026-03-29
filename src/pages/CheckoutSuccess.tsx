import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';
import { useBranding } from '@/hooks/useBranding';
import sashikoLogo from '@/assets/sashiko-logo.png';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/BackButton';

export default function CheckoutSuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const { branding } = useBranding();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setLoading(false);
        navigate('/order-history', { replace: true });
        return;
      }

      console.log('Verifying payment for session:', sessionId);

      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
        });

        if (error) {
          console.error('Verification error:', error);
          throw error;
        }

        console.log('Verification result:', data);

        if (data?.success) {
          clearCart();
          // Always redirect to order tracking
          if (data.order_id) {
            navigate(`/order-tracking/${data.order_id}`, { replace: true });
            return;
          }
          // Fallback: try to find the order by order_number
          if (data.order_number) {
            setOrderNumber(data.order_number);
          }
          // Even without order_id, navigate to orders list
          navigate('/order-history', { replace: true });
          return;
        } else {
          setError(data?.message || 'Payment verification failed');
        }
      } catch (err: any) {
        console.error('Error verifying payment:', err);
        setError(err.message || 'Failed to verify payment');
        toast({
          title: 'Verification failed',
          description: 'We could not verify your payment. Please contact support.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, clearCart, navigate, toast]);

  if (loading) {
    return <LoadingScreen show={true} />;
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton />
          </div>
          <Card className="border-destructive">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-16 w-16 text-destructive" />
                </div>
                <CardTitle className="text-3xl">{t('checkoutSuccess.verificationIssue')}</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">
                  {t('checkoutSuccess.chargedContact')}
                </p>
                <div className="flex gap-4 justify-center pt-4">
                  <Button onClick={() => navigate('/order-history')} variant="default">
                    {t('checkoutSuccess.viewOrders')}
                  </Button>
                  <Button onClick={() => navigate('/')} variant="outline">
                    {t('nav.home')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton />
        </div>
        <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl">{t('checkoutSuccess.paymentSuccessful')}</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {orderNumber && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t('checkoutSuccess.orderNumber')}</p>
                  <p className="text-2xl font-bold text-primary">{orderNumber}</p>
                </div>
              )}
              <p className="text-muted-foreground">
                {t('checkoutSuccess.thankYou')}
              </p>
              <p className="text-muted-foreground">
                {t('checkoutSuccess.trackOrder')}
              </p>
              <div className="flex gap-4 justify-center pt-4">
                <Button onClick={() => navigate('/order-history')} variant="default">
                  {t('checkoutSuccess.viewOrders')}
                </Button>
                <Button onClick={() => navigate('/')} variant="outline">
                  {t('checkoutSuccess.continueShopping')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
  );
}
