import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Collapsible Section ── */
interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Use "rows" for divider-separated rows, "actions" for button lists */
  variant?: "rows" | "actions";
}

export function SettingsSection({
  icon: Icon,
  title,
  open,
  onOpenChange,
  children,
  variant = "rows",
}: SettingsSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{title}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent
            className={cn(
              "pt-0 px-4 pb-4",
              variant === "rows" ? "space-y-1" : "space-y-3"
            )}
          >
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ── Row inside a section (label + value) ── */
interface SettingsRowProps {
  icon?: LucideIcon;
  label: string;
  value?: string;
  onClick?: () => void;
  /** Custom right-side content instead of value + chevron */
  children?: React.ReactNode;
  /** Whether to show divider above this row */
  showDivider?: boolean;
  className?: string;
}

export function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  children,
  showDivider = false,
  className,
}: SettingsRowProps) {
  const isClickable = !!onClick;

  return (
    <>
      {showDivider && <div className="border-t border-border" />}
      <div
        className={cn(
          "flex items-center justify-between py-3 px-1 rounded-md transition-colors",
          isClickable && "cursor-pointer hover:bg-muted/50",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {children || (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{value || "—"}</span>
            {isClickable && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Navigation link card ── */
interface SettingsLinkProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

export function SettingsLink({ icon: Icon, title, subtitle, onClick }: SettingsLinkProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <span className="font-medium">{title}</span>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
