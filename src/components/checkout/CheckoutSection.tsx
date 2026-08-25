import { ReactNode, forwardRef } from 'react';

interface CheckoutSectionProps {
  /** Small uppercase step eyebrow, e.g. "Step 1". */
  step?: string;
  title?: string;
  /** Optional light note rendered next to the title. */
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Hairline rule below the section. */
  divider?: boolean;
  className?: string;
  /** Passed through so existing scroll/highlight logic keeps working. */
  dataSection?: string;
}

/**
 * Flat, editorial checkout section: no card, no grey fill — just generous
 * spacing and a hairline rule. Keeps the whole page reading as one column.
 */
export const CheckoutSection = forwardRef<HTMLElement, CheckoutSectionProps>(
  ({
    step,
    title,
    note,
    action,
    children,
    divider = true,
    className = '',
    dataSection,
  }, ref) => (
    <section
      ref={ref}
      data-section={dataSection}
      className={`py-5 rounded-lg ${divider ? 'border-b border-border/50' : ''} ${className}`}
    >
      {(step || title || action) && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            {step && (
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {step}
              </p>
            )}
            {title && (
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                {title}
                {note && <span className="ml-2 font-body text-sm font-normal text-muted-foreground">{note}</span>}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
);

CheckoutSection.displayName = 'CheckoutSection';
