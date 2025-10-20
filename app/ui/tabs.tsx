// app/ui/tabs.tsx
"use client";
import * as React from "react";

type TabsContext = { value: string; set: (v: string) => void };
const Ctx = React.createContext<TabsContext | null>(null);

export function Tabs({
  defaultValue,
  children,
  className = "",
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, set] = React.useState(defaultValue);
  return (
    <Ctx.Provider value={{ value, set }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`inline-flex items-center rounded-md border p-1 ${className}`} {...rest} />;
}

export function TabsTrigger({
  value,
  className = "",
  children,
  disabled = false,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean; // 👈 ahora soporta disabled
}) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>");

  const active = ctx.value === value;

  return (
    <button
      type="button"
      onClick={() => !disabled && ctx.set(value)} // no cambia si está disabled
      disabled={disabled}
      className={`px-3 py-1.5 text-sm rounded-sm transition
        ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>");
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
