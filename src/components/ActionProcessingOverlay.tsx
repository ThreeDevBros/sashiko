import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface ActionProcessingOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
}

export function ActionProcessingOverlay({ visible, title, subtitle }: ActionProcessingOverlayProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[10050] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />
          <motion.div
            className="relative flex w-full max-w-xs flex-col items-center rounded-[2rem] border border-border/60 bg-card p-9 shadow-2xl"
            initial={{ scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <div className="relative mb-7 h-20 w-20">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.15" strokeWidth="3" />
                <path
                  d="M50 6 A44 44 0 0 1 94 50"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  strokeLinecap="round"
                  style={reduceMotion ? undefined : { animation: 'payment-arc-spin 1.05s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite', transformOrigin: '50% 50%' }}
                />
              </svg>
            </div>
            <h2 className="text-center text-lg font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}