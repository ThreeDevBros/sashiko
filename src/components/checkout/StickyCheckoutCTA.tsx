import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { GuestValidationErrors } from '@/lib/guestValidation';

interface StickyCheckoutCTAProps {
  summaryRef: React.RefObject<HTMLElement>;
  guestInfoRef?: React.RefObject<HTMLElement>;
  paymentRef?: React.RefObject<HTMLElement>;
  isGuest: boolean;
  guestInfo: { name: string; email: string; phone: string };
  guestValidationErrors?: GuestValidationErrors;
  checkingDelivery?: boolean;
  placeOrderButton: React.ReactNode;
}

export function StickyCheckoutCTA({
  summaryRef,
  guestInfoRef,
  paymentRef,
  isGuest,
  guestInfo,
  guestValidationErrors,
  checkingDelivery = false,
  placeOrderButton,
}: StickyCheckoutCTAProps) {
  const { t } = useTranslation();
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const targets: { ref: React.RefObject<HTMLElement>; key: string }[] = [
      { ref: summaryRef, key: 'summary' },
      { ref: paymentRef, key: 'payment' },
    ];
    if (isGuest && guestInfoRef) {
      targets.push({ ref: guestInfoRef, key: 'guest-info' });
    }

    const elements = targets
      .map(({ ref, key }) => ({ el: ref.current, key }))
      .filter(({ el }) => !!el) as { el: HTMLElement; key: string }[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSections((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const key = entry.target.getAttribute('data-section');
            if (!key) return;
            if (entry.isIntersecting) {
              next.add(key);
            } else {
              next.delete(key);
            }
          });
          return next;
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    );

    elements.forEach(({ el }) => observer.observe(el));
    return () => observer.disconnect();
  }, [summaryRef, guestInfoRef, paymentRef, isGuest]);

  const summaryReached = visibleSections.has('summary');

  const handleContinue = useCallback(() => {
    const sections: { key: string; ref: React.RefObject<HTMLElement> | undefined }[] = [
      { key: 'guest-info', ref: guestInfoRef },
      { key: 'payment', ref: paymentRef },
      { key: 'summary', ref: summaryRef },
    ];

    // For guest mode, check if guest info is invalid/incomplete first.
    if (isGuest && guestInfoRef?.current) {
      const hasError = guestValidationErrors && (
        guestValidationErrors.name ||
        guestValidationErrors.email ||
        guestValidationErrors.phone
      );
      const hasEmpty = !guestInfo.name || !guestInfo.email || !guestInfo.phone;
      if (hasError || hasEmpty) {
        const firstId = !guestInfo.name
          ? 'guest-name'
          : !guestInfo.email
          ? 'guest-email'
          : 'guest-phone';
        guestInfoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const el = document.getElementById(firstId);
          if (el) el.focus({ preventScroll: true });
        }, 450);
        return;
      }
    }

    // Scroll to the first tracked section that is not yet visible.
    for (const { key, ref } of sections) {
      if (ref?.current && !visibleSections.has(key)) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // Fallback to summary if everything else is already visible.
    summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isGuest, guestInfo, guestValidationErrors, guestInfoRef, paymentRef, summaryRef, visibleSections]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="container max-w-2xl mx-auto px-4 pt-3 pb-3">
        {checkingDelivery ? (
          <Button className="w-full h-14 rounded-2xl" size="lg" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking delivery zone...
          </Button>
        ) : summaryReached ? (
          placeOrderButton
        ) : (
          <Button
            type="button"
            onClick={handleContinue}
            className="w-full h-14 rounded-2xl font-semibold text-base bg-primary text-primary-foreground hover:brightness-[1.06]"
          >
            {t('checkout.continue')}
          </Button>
        )}
      </div>
    </div>
  );
}
