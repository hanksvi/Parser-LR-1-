import * as React from "react";
type V = "default"|"secondary"|"outline"|"destructive";
export function Badge({variant="default", className="", ...p}: React.HTMLAttributes<HTMLSpanElement> & {variant?:V}) {
  const base="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const s:Record<V,string>={
    default:"bg-primary text-primary-foreground",
    secondary:"bg-secondary text-secondary-foreground",
    outline:"border border-border text-foreground",
    destructive:"bg-destructive text-destructive-foreground",
  };
  return <span className={`${base} ${s[variant]} ${className}`} {...p} />;
}
