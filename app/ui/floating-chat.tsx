"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

type FloatingChatProps = {
  context?: Record<string, any>;
  title?: string;
};

export default function FloatingChat({
  context,
  title = "Asistente LR(1)",
}: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola, soy tu asistente LR(1). ¿Qué revisamos?" },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Persistencia simple
  useEffect(() => {
    const raw = localStorage.getItem("lr1-chat");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("lr1-chat", JSON.stringify(messages));
  }, [messages]);

  // autoscroll
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  // Texto con formato simple (sin librerías)
  const renderText = (t: string) => {
    // Partimos en líneas y párrafos, permitimos listas simples con "- "
    return (
      <div className="space-y-2 text-[13px] leading-5">
        {t.split("\n").map((line, i) => {
          if (line.trim().startsWith("- ")) {
            return (
              <div key={i} className="pl-5 relative">
                <span className="absolute left-0">•</span>
                {line.replace(/^-+\s*/, "")}
              </div>
            );
          }
          return <p key={i}>{line}</p>;
        })}
      </div>
    );
  };

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, context }),
      });

      let data: any = null;
      try { data = await r.json(); } catch {}

      const replyText =
        (r.ok && data?.reply) ||
        data?.reply ||
        data?.error ||
        `No pude obtener respuesta (HTTP ${r.status}). Si estás probando, pon USE_MOCK_AI=true en .env.local.`;

      setMessages((prev) => [...prev, { role: "assistant", content: String(replyText) }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error de red: ${e?.message ?? e}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // permite Enter para enviar
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") send();
  }

  const hasUnread = useMemo(() => !open && messages.length > 1, [open, messages.length]);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full shadow-xl bg-black text-white flex items-center justify-center hover:scale-[1.03] active:scale-95 transition"
        aria-label="Abrir chat"
      >
        <MessageSquare />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {/* Panel flotante */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[70] w-[360px] max-w-[94vw] h-[520px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <div className="font-semibold">{title}</div>
            </div>
            <button
              className="p-1 rounded hover:bg-white/20"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] p-2 rounded-2xl ${
                  m.role === "user"
                    ? "ml-auto bg-white border"
                    : "bg-indigo-50 border border-indigo-100"
                }`}
              >
                <div className="text-[11px] opacity-60 mb-1">
                  {m.role === "user" ? "Tú" : "IA"}
                </div>
                {renderText(m.content)}
              </div>
            ))}
            {loading && <div className="text-xs opacity-60">Pensando…</div>}
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white flex gap-2 items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pregúntame sobre tu gramática…"
              className="flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-black text-white text-sm flex items-center gap-1 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
