// components/ui/button.tsx (o la ruta donde lo tengas)
import * as React from "react";

type Variant = "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
type Size = "sm" | "default" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-medium " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50 transition-colors";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-background text-foreground hover:bg-muted",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  link: "bg-transparent text-primary underline-offset-4 hover:underline",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  default: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...p }, ref) => {
    const classes = [base, variants[variant], sizes[size], className].join(" ");
    return <button ref={ref} className={classes} {...p} />;
  }
);

Button.displayName = "Button";

export default Button;
