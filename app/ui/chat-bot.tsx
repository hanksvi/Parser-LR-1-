"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatBot({ context }: { context?: Record<string, any> }) {
  const [messages, setMessages] = useState<Msg[]>(
    [{ role: "assistant", content: "Hola, soy tu asistente LR(1). ¿Qué revisamos?" }] satisfies Msg[]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;

    const userMsg: Msg = { role: "user", content: input };
    const newMsgs: Msg[] = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, context }),
      });

      // intenta parsear json siempre
      let data: any = null;
      try { data = await r.json(); } catch { /* noop */ }

      // si el server devolvió 200 ok, uso data.reply
      if (r.ok && data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: String(data.reply) }]);
        return;
      }

      // si vino 4xx/5xx o no hay reply, muestro un fallback útil
      const fallback =
        data?.reply ??
        data?.error ??
        `No pude obtener respuesta de la IA (HTTP ${r.status}). Si estás en modo demo, pon USE_MOCK_AI=true; si quieres respuesta real, revisa tu cuota en OpenAI.`;

      setMessages(prev => [...prev, { role: "assistant", content: String(fallback) }]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error de red/cliente: ${e?.message ?? e}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col border rounded-2xl p-3 bg-white">
      <div className="font-semibold mb-2">Asistente LR(1)</div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-xl text-sm ${m.role === "user" ? "bg-gray-100" : "bg-white border"}`}
          >
            <b>{m.role === "user" ? "Tú" : "IA"}:</b> {m.content}
          </div>
        ))}
        {loading && <div className="text-xs opacity-60">Pensando…</div>}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded-xl px-3 py-2 text-sm"
          placeholder="Pregúntame sobre tu gramática, conflictos, etc."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
        />
        <button onClick={send} disabled={loading} className="px-3 py-2 rounded-xl bg-black text-white text-sm">
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
