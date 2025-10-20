"use client";
import * as React from "react";

export function GrammarInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-40 rounded-md border px-3 py-2 text-sm shadow-sm
                 bg-white text-black placeholder-gray-400
                 focus:outline-none focus:ring-2 focus:ring-primary
                 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
    />
  );
}

