import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Renders a show/hide toggle and swaps the input type. */
  reveal?: boolean;
};

/**
 * Hairline, underline-style input with a floating label.
 * No boxes, no filled surfaces — the field is drawn with a single rule that
 * warms to the brand accent on focus.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, reveal, className, id, type = "text", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputType = reveal ? (visible ? "text" : "password") : type;

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={inputType}
          placeholder=" "
          className={cn(
            "peer w-full bg-transparent border-b border-border/70 pt-6 pb-2 text-base text-foreground",
            "placeholder:text-transparent focus:outline-none focus:border-primary",
            "transition-colors duration-200 rounded-none",
            reveal && "pr-14",
            className,
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-0 top-6 origin-left text-base text-muted-foreground",
            "transition-all duration-200 ease-out",
            "peer-focus:-translate-y-5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.16em] peer-focus:text-primary",
            "peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.16em]",
          )}
        >
          {label}
        </label>
        {reveal && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-0 top-6 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary transition-opacity hover:opacity-70"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  },
);

AuthField.displayName = "AuthField";

export default AuthField;
