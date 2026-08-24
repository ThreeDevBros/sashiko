import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';

const shellBase =
  'relative rounded-xl border bg-transparent transition-colors focus-within:border-primary';

const labelBase =
  'pointer-events-none absolute left-3 top-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors';

interface CommonProps {
  label: string;
  /** Shows a subtle "Required" hint instead of a red asterisk. */
  requiredHint?: string;
  /** Any truthy value puts the field in its red invalid state (no message shown). */
  error?: string;
  containerClassName?: string;
}

export const FloatingLabelInput = forwardRef<
  HTMLInputElement,
  CommonProps & InputHTMLAttributes<HTMLInputElement>
>(({ label, requiredHint, error, containerClassName = '', className = '', id, ...props }, ref) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const invalid = !!error;
  return (
    <div className={containerClassName}>
      <div className={`${shellBase} ${invalid ? 'border-destructive' : 'border-border'}`}>
        <label
          htmlFor={inputId}
          className={`${labelBase} ${invalid ? 'text-destructive' : 'text-muted-foreground/70'}`}
        >
          <span>{label}</span>
          {requiredHint && (
            <span
              className={`text-[10px] font-normal normal-case tracking-normal ${
                invalid ? 'text-destructive/80' : 'text-muted-foreground/60'
              }`}
            >
              {requiredHint}
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={invalid || undefined}
          className={`w-full bg-transparent px-3 pb-2.5 pt-7 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
      </div>
    </div>
  );
});
FloatingLabelInput.displayName = 'FloatingLabelInput';

export const FloatingLabelTextarea = forwardRef<
  HTMLTextAreaElement,
  CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ label, requiredHint, error, containerClassName = '', className = '', id, ...props }, ref) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const invalid = !!error;
  return (
    <div className={containerClassName}>
      <div className={`${shellBase} ${invalid ? 'border-destructive' : 'border-border'}`}>
        <label
          htmlFor={inputId}
          className={`${labelBase} ${invalid ? 'text-destructive' : 'text-muted-foreground/70'}`}
        >
          <span>{label}</span>
          {requiredHint && (
            <span
              className={`text-[10px] font-normal normal-case tracking-normal ${
                invalid ? 'text-destructive/80' : 'text-muted-foreground/60'
              }`}
            >
              {requiredHint}
            </span>
          )}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={invalid || undefined}
          className={`w-full resize-none bg-transparent px-3 pb-2.5 pt-7 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
      </div>
    </div>
  );
});
FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';
