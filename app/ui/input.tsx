// app/ui/input.tsx
import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        {...props}
        className={[
          "w-full rounded-md border px-3 py-2 text-sm shadow-sm",
          "border-gray-300 bg-white text-black placeholder-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          " disabled:cursor-not-allowed",
          className,
        ].join(" ")}
      />
    );
  }
);
Input.displayName = "Input";
