import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

interface PaymentProcessingOverlayProps {
  status: PaymentStatus;
  message?: string | null;
  onDismiss?: () => void;
}

const SIZE = 96;
const R = 40;
const C = 2 * Math.PI * R;

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

  const ringColor =
    status === 'success' ? 'hsl(var(--primary))' : status === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center px-6"
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
            className="relative flex flex-col items-center text-center gap-5 max-w-sm w-full"
            initial={{ scale: reduce ? 1 : 0.94, y: reduce ? 0 : 8 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
              <svg width={SIZE} height={SIZE} viewBox="0 0 96 96" className="overflow-visible">
                {/* Track */}
                <circle cx="48" cy="48" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
                {/* Arc / full ring */}
                <motion.g
                  style={{ originX: '48px', originY: '48px' }}
                  animate={status === 'processing' && !reduce ? { rotate: 360 } : { rotate: 0 }}
                  transition={
                    status === 'processing' && !reduce
                      ? { repeat: Infinity, ease: 'linear', duration: 0.9 }
                      : { duration: 0.3, ease: 'easeOut' }
                  }
                >
                  <motion.circle
                    cx="48"
                    cy="48"
                    r={R}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    initial={{ strokeDashoffset: C * 0.75 }}
                    animate={{ strokeDashoffset: status === 'processing' ? C * 0.75 : 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </motion.g>

                {/* Success tick */}
                {status === 'success' && (
                  <motion.path
                    d="M31 49.5 L43 61 L66 37"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                  />
                )}

                {/* Error cross */}
                {status === 'error' && (
                  <>
                    <motion.path
                      d="M35 35 L61 61"
                      stroke={ringColor}
                      strokeWidth="6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.25, delay: 0.12 }}
                    />
                    <motion.path
                      d="M61 35 L35 61"
                      stroke={ringColor}
                      strokeWidth="6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.25, delay: 0.28 }}
                    />
                  </>
                )}
              </svg>
            </div>

            <div className="space-y-1.5">
              <motion.p
                key={title}
                className="text-lg font-semibold text-foreground"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {title}
              </motion.p>
              <motion.p
                key={subtitle}
                className="text-sm text-muted-foreground"
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
                className="w-full"
              >
                <Button type="button" onClick={onDismiss} className="w-full h-11">
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
