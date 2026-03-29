import { useState } from 'react';
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Check, CreditCard, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCardVisual } from './CreditCardVisual';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const getStripeElementStyle = () => {
  const isDesktop = window.innerWidth >= 768;
  return {
    base: {
      fontSize: isDesktop ? '20px' : '15px',
      lineHeight: isDesktop ? '32px' : '24px',
      color: '#e0f2fe',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: 'rgba(100, 116, 139, 0.5)',
      },
      iconColor: '#94a3b8',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  };
};

export const AddCardForm = ({ onSuccess, onCancel }: AddCardFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);

  const isComplete = cardholderName.trim().length > 0 && cardNumberComplete && cardExpiryComplete && cardCvcComplete;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) return;

    setLoading(true);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card', card: cardNumberElement,
        billing_details: { name: cardholderName },
      });
      if (pmError) throw new Error(pmError.message);

      const { error } = await supabase.functions.invoke('save-payment-method', {
        body: { paymentMethodId: paymentMethod.id },
      });
      if (error) throw error;

      toast({ title: 'Card saved', description: 'Your card has been saved successfully.' });
      onSuccess();
    } catch (error: any) {
      console.error('Error saving card:', error);
      toast({ title: 'Failed to save card', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="w-full mt-3 space-y-3">
      {/* Credit card visual */}
      <CreditCardVisual>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.87em' }}>
          {/* Cardholder Name */}
          <div>
            <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
              Cardholder
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-[#e0f2fe] placeholder:text-slate-500/50 p-0"
              style={{ fontSize: '1.1em' }}
            />
          </div>

          {/* Card Number */}
          <div>
            <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
              Card Number
            </label>
            <CardNumberElement
              options={{ style: getStripeElementStyle(), showIcon: true }}
              onChange={(e) => setCardNumberComplete(e.complete)}
            />
          </div>

          {/* Expiry + CVC side by side */}
          <div className="flex" style={{ gap: '1.75em' }}>
            <div className="flex-1">
              <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
                Expiry
              </label>
              <CardExpiryElement
                options={{ style: getStripeElementStyle() }}
                onChange={(e) => setCardExpiryComplete(e.complete)}
              />
            </div>
            <div className="flex-1">
              <label className="font-medium text-slate-400/70 uppercase tracking-wider block" style={{ fontSize: '0.8em', marginBottom: '0.3em' }}>
                CVC
              </label>
              <CardCvcElement
                options={{ style: getStripeElementStyle() }}
                onChange={(e) => setCardCvcComplete(e.complete)}
              />
            </div>
          </div>
        </div>
      </CreditCardVisual>

        {isComplete && (
          <div className="flex items-center justify-center gap-2 text-green-500 text-sm">
            <Check className="h-4 w-4" />
            <span>Card details complete</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
          <Lock className="h-3 w-3" />
          <p className="text-xs">Secured with Stripe encryption</p>
        </div>

        {/* Save Card button */}
        <Button
          type="button"
          onClick={handleSubmit}
          className="w-full h-10"
          disabled={!stripe || !isComplete || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Card'
          )}
        </Button>
    </div>
  );
};
