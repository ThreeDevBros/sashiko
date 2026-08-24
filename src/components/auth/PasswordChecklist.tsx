import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const PASSWORD_RULES = [
  { key: "length", label: "At least 12 characters", test: (v: string) => v.length >= 12 },
  { key: "upper", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { key: "number", label: "One number", test: (v: string) => /[0-9]/.test(v) },
];

interface PasswordChecklistProps {
  value: string;
  className?: string;
}

/**
 * Live password requirement checklist with a thin strength bar.
 * Renders nothing until the user starts typing.
 */
export function PasswordChecklist({ value, className }: PasswordChecklistProps) {
  if (!value) return null;

  const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
  const ratio = passed / PASSWORD_RULES.length;
  const strengthLabel = ratio === 1 ? "Strong" : ratio >= 0.5 ? "Getting there" : "Weak";

  return (
    <div className={cn("space-y-1.5", className)} aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              ratio === 1 ? "bg-primary" : ratio >= 0.5 ? "bg-accent" : "bg-destructive"
            )}
            style={{ width: `${Math.max(ratio * 100, 8)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{strengthLabel}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-1 text-[10px] transition-colors",
                ok ? "text-primary" : "text-muted-foreground"
              )}
            >
              {ok ? (
                <Check className="h-3 w-3 flex-shrink-0" />
              ) : (
                <X className="h-3 w-3 flex-shrink-0 opacity-50" />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
