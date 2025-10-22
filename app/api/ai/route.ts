import { NextRequest } from "next/server";
import OpenAI, { APIError } from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modo demo: responde sin llamar a OpenAI cuando USE_MOCK_AI=true
const USE_MOCK = process.env.USE_MOCK_AI === "true";

const SYSTEM_PROMPT = `
Eres un asistente experto en análisis LR(1).
- Ayudas a construir FIRST/FOLLOW, colección LR(1), tabla de parsing y explicar conflictos shift/reduce y reduce/reduce.
- Respondes en español, paso a paso y con ejemplos cuando sea útil.
`;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    if (USE_MOCK) {
      // Mensaje de demo más útil
      const { grammar = "", precedence = [], isBlocked } = context ?? {};
      const reply =
        `🔁 Modo demo (sin llamada a la API real)\n` +
        `Gramática:\n${grammar}\n\n` +
        (isBlocked
          ? `Tu tabla está bloqueada por conflictos. Prueba niveles de precedencia, p. ej.:\n` +
            `- Nivel 0 (left): +, -\n- Nivel 1 (left): *, /\n- Nivel 2 (right): ^\nLuego reconstruye.`
          : `No veo bloqueos. Pide: "explícame los items LR(1)", "muestra conflictos", o "sugiere precedencia".`);
      return new Response(JSON.stringify({ reply }), { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const model = process.env.OPENAI_MODEL || "gpt-5";

    const ctx = context
      ? `\n\n[CONTEXTO LR1]\n${JSON.stringify(context).slice(0, 8000)}`
      : "";

    const completion = await client.responses.create({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(messages ?? []),
        { role: "user", content: `Ten en cuenta este contexto si aplica:\n${ctx}` },
      ],
      // ¡No enviar temperature con este modelo!
    });

    return new Response(
      JSON.stringify({ reply: completion.output_text ?? "Sin respuesta." }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    // Si no hay cuota, devolvemos 200 con mensaje amigable para que la UI siempre muestre texto
    if (err instanceof APIError && (err.status === 429 || err.code === "insufficient_quota")) {
      const reply =
        "No hay cuota en tu cuenta/proyecto de OpenAI. Ve a Billing o activa USE_MOCK_AI=true para probar sin la API real.";
      return new Response(JSON.stringify({ reply }), { status: 200 });
    }
    console.error(err);
    const reply = `Error en backend: ${err?.message ?? "desconocido"}`;
    return new Response(JSON.stringify({ reply }), { status: 200 });
  }
}
