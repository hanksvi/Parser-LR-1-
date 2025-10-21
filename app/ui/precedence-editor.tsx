"use client";

import React from "react";

type Assoc = "left" | "right" | "nonassoc";

export type PrecLevel = {
  assoc: Assoc;
  tokens: string[]; // e.g. ["+", "-"]
};

export type PrecedenceEditorProps = {
  // Lista completa de terminales para sugerir/validar (opcional).
  terminals?: string[];
  // Valor controlado externo (para levantar el estado al contenedor).
  value: PrecLevel[];
  onChange: (levels: PrecLevel[]) => void;
};

const assocOptions: Assoc[] = ["left", "right", "nonassoc"];

export default function PrecedenceEditor({
  terminals,
  value,
  onChange,
}: PrecedenceEditorProps) {
  function updateLevel(idx: number, patch: Partial<PrecLevel>) {
    const next = value.map((lvl, i) => (i === idx ? { ...lvl, ...patch } : lvl));
    onChange(next);
  }

  function addLevel() {
    onChange([...value, { assoc: "left", tokens: [] }]);
  }

  function removeLevel(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...value];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(idx: number) {
    if (idx === value.length - 1) return;
    const next = [...value];
    [next[idx + 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function setTokensFromCSV(idx: number, csv: string) {
    // partes separadas por coma/espacio, sin vacíos
    const toks = csv
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    // Validación blanda con terminals (si llega):
    const filtered = terminals && terminals.length
      ? toks.filter((t) => terminals.includes(t))
      : toks;
    updateLevel(idx, { tokens: filtered });
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Precedencia & Asociatividad (de menor a mayor)
        </h3>
        <div className="flex gap-2">
          {/* Presets rápidos */}
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border"
            onClick={() =>
              onChange([
                { assoc: "left", tokens: ["+", "-"] },
                { assoc: "left", tokens: ["*", "/"] },
                { assoc: "right", tokens: ["^"] },
              ])
            }
          >
            Preset: Expresiones (+,- | *,/ | ^)
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border"
            onClick={() => onChange([])}
          >
            Vaciar
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border"
            onClick={addLevel}
          >
            + Nivel
          </button>
        </div>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-neutral-500">
          No hay niveles. Agrega uno o usa un preset.
        </p>
      )}

      <div className="space-y-2">
        {value.map((lvl, idx) => (
          <div
            key={idx}
            className="rounded border p-3 flex flex-col gap-2 bg-white"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Nivel {idx}</span>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border"
                  onClick={() => moveUp(idx)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border"
                  onClick={() => moveDown(idx)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border text-red-600"
                  onClick={() => removeLevel(idx)}
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Asociatividad */}
              <label className="text-xs">
                Asociatividad
                <select
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={lvl.assoc}
                  onChange={(e) =>
                    updateLevel(idx, { assoc: e.target.value as Assoc })
                  }
                >
                  {assocOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              {/* Tokens (CSV) */}
              <label className="text-xs md:col-span-2">
                Tokens (separados por coma o espacio)
                <input
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  placeholder="+ - * / ^"
                  defaultValue={lvl.tokens.join(", ")}
                  onBlur={(e) => setTokensFromCSV(idx, e.target.value)}
                />
                {terminals && terminals.length > 0 && (
                  <span className="block mt-1 text-[11px] text-neutral-500">
                    Sugerencia: {terminals.slice(0, 20).join(" · ")}
                    {terminals.length > 20 ? " …" : ""}
                  </span>
                )}
              </label>
            </div>

            {/* Preview mini */}
            <div className="text-[11px] text-neutral-600">
              JSON:{" "}
              <code>
                {JSON.stringify({ assoc: lvl.assoc, tokens: lvl.tokens })}
              </code>
            </div>
          </div>
        ))}
      </div>

      {/* Preview general */}
      <div className="text-[11px] text-neutral-600">
        Precedence payload:{" "}
        <code>{JSON.stringify(value)}</code>
      </div>
    </div>
  );
}
