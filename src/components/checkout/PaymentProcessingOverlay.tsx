import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

interface PaymentProcessingOverlayProps {
  status: PaymentStatus;
  message?: string | null;
  onDismiss?: () => void;
}

export const PaymentProcessingOverlay = ({ status, message, onDismiss }: PaymentProcessingOverlayProps) => {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const visible = status !== 'idle';

  const title =
    status === 'success'
      ? t('payment.successTitle', 'Payment successful')
      : status === 'error'
        ? t('payment.failedTitle', 'Payment failed')
        : t('payment.processingTitle', 'Processing payment');

  const subtitle =
    status === 'success'
      ? t('payment.successSubtitle', 'Taking you to your order')
      : status === 'error'
        ? message || t('payment.failedSubtitle', 'Something went wrong. Please try again.')
        : t('payment.processingSubtitle', 'Please do not close this page');

  const accent = status === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 10050 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />

          <motion.div
            className="relative w-full max-w-xs flex flex-col items-center rounded-[2.5rem] border border-border/60 bg-card p-10 shadow-2xl"
            initial={{ scale: reduce ? 1 : 0.94, y: reduce ? 0 : 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            {/* Loader */}
            <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
              {/* Track */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.15" strokeWidth="3" />
              </svg>

              {/* Ring that completes on resolve */}
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={accent}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                  animate={{ strokeDashoffset: status === 'processing' ? 2 * Math.PI * 44 : 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>

              {/* Spinning gradient arc (pure CSS rotation = perfectly centered, no jitter) */}
              <AnimatePresence>
                {status === 'processing' && (
                  <motion.svg
                    key="arc"
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    style={
                      reduce
                        ? undefined
                        : {
                            animation: 'payment-arc-spin 1.05s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
                            transformOrigin: '50% 50%',
                          }
                    }
                  >
                    <defs>
                      <linearGradient id="payment-arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={accent} stopOpacity="0" />
                        <stop offset="100%" stopColor={accent} stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M50 6 A44 44 0 0 1 94 50"
                      fill="none"
                      stroke="url(#payment-arc-gradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </motion.svg>
                )}
              </AnimatePresence>

              {/* Success tick */}
              {status === 'success' && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                  <motion.path
                    d="M32 51 L44 63 L69 36"
                    fill="none"
                    stroke={accent}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                  />
                </svg>
              )}

              {/* Error cross */}
              {status === 'error' && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                  <motion.path
                    d="M37 37 L63 63"
                    stroke={accent}
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.22, delay: 0.18 }}
                  />
                  <motion.path
                    d="M63 37 L37 63"
                    stroke={accent}
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.22, delay: 0.34 }}
                  />
                </svg>
              )}
            </div>

            {/* Copy */}
            <div className="space-y-2 text-center">
              <motion.h3
                key={title}
                className="text-lg font-medium tracking-tight text-foreground"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {title}
              </motion.h3>
              <motion.p
                key={subtitle}
                className="text-sm font-light text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05 }}
              >
                {subtitle}
              </motion.p>
            </div>

            {status === 'error' && onDismiss && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mt-8 w-full"
              >
                <Button type="button" onClick={onDismiss} className="h-11 w-full rounded-full">
                  {t('payment.tryAgain', 'Try again')}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
