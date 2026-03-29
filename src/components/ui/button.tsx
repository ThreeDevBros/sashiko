import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 shadow hover:shadow-md active:scale-95",
  {
    variants: {
      variant: {
        default: "backdrop-blur-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20",
        destructive: "backdrop-blur-sm bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border backdrop-blur-xl bg-card/60 hover:bg-card/80 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900/80",
        secondary: "backdrop-blur-sm bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:backdrop-blur-sm hover:bg-accent/10",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-lg px-2 text-xs",
        lg: "h-9 rounded-lg px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
