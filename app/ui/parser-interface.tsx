"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { Button } from "@/app/ui/button";
import { Input } from "@/app/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/ui/tabs";
import { GrammarInput } from "./grammar-input";
import { ParsingTable } from "./parsing-table";
import { ParsingSteps } from "./parsing-steps";
import { AutomatonVisualizer } from "./automaton-visualizer";
import {
  Play, FileText, Table, Settings, GitBranch, Workflow, Sparkles,
  CheckCircle2, AlertTriangle, Wand2, RefreshCw
} from "lucide-react";
import PrecedenceEditor, { PrecLevel } from "./precedence-editor";
import FloatingChat from "./floating-chat"; // 👈 chat flotante

type SuggestedLevel = { assoc: "left" | "right" | "nonassoc"; tokens: string[] };

export function ParserInterface() {
  const [grammar, setGrammar] = useState(`S -> E
E -> E + E
E -> E * E
E -> ( E )
E -> id`);
  const [inputString, setInputString] = useState("id + id * id");
  const [parserData, setParserData] = useState<any>(null);
  const [parsingResult, setParsingResult] = useState<any>(null);
  const [nfa, setNfa] = useState<any>(null);
  const [dfa, setDfa] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [precedence, setPrecedence] = useState<PrecLevel[]>([]);
  const [autoBuild, setAutoBuild] = useState<boolean>(false);

  // ------- persistencia simple de precedencia -------
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("precedence-levels") : null;
    if (raw) { try { setPrecedence(JSON.parse(raw)); } catch {} }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("precedence-levels", JSON.stringify(precedence));
    }
  }, [precedence]);

  // ------- helpers -------
  const normalizeArrows = (s: string) =>
    s.replaceAll("⇒", "->").replaceAll("→", "->").replaceAll("—>", "->").replaceAll("–>", "->");

  const prettyBackendError = (msg: string): string => {
    if (!msg) return "Ocurrió un error.";
    if (msg.includes("Falta '->'")) return "Usa '->' para separar LHS y RHS (normalizamos ‘→’ automáticamente).";
    return msg;
  };

  const isBlocked = Boolean(parserData?.blocked);
  const terminals: string[] = parserData?.table_data?.terminals ?? [];
  const suggested = (parserData?.suggested_precedence || []) as SuggestedLevel[];

  // ------- build / parse -------
  const runBuild = async () => {
    setIsLoading(true);
    setError(null);
    setNfa(null);
    setDfa(null);

    try {
      const normalizedGrammar = normalizeArrows(grammar);
      const buildPayload: any = { grammar: normalizedGrammar };
      if (precedence.length > 0) {
        buildPayload.precedence = precedence.map(l => ({ assoc: l.assoc, tokens: l.tokens }));
      }

      const parserResponse = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "lr1_parser.py",
          args: ["build", JSON.stringify(buildPayload)],
        }),
      });
      const parserResult = await parserResponse.json();
      if (!parserResponse.ok || !parserResult.success) throw new Error(parserResult.error || "Error building parser");
      setParserData(parserResult);

      const automatonResponse = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "automaton_builder.py",
          args: ["build_both", JSON.stringify({ grammar: normalizedGrammar })],
        }),
      });
      const automatonResult = await automatonResponse.json();
      if (!automatonResponse.ok || !automatonResult.success) throw new Error(automatonResult.error || "Error construyendo AFN/DFA");
      setNfa(automatonResult.nfa);
      setDfa(automatonResult.dfa);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error building parser";
      setError(prettyBackendError(raw));
    } finally {
      setIsLoading(false);
    }
  };

  const handleParse = async () => {
    if (!parserData || parserData.blocked) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "lr1_parser.py",
          args: ["parse", JSON.stringify({ grammar, input: inputString, precedence })],
        }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setParsingResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error parsing input");
    } finally {
      setIsLoading(false);
    }
  };

  // ------- reconstrucción automática con debounce -------
  const debounceRef = useRef<any>(null);
  useEffect(() => {
    if (!autoBuild) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { runBuild(); }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grammar, JSON.stringify(precedence), autoBuild]);

  // ------- presentar conflictos de forma más legible -------
  const conflictSummary = useMemo(() => {
    const list: string[] = parserData?.ambiguity?.conflicts || [];
    const bySym: Record<string, number> = {};
    let total = 0;
    for (const c of list) {
      const m = c.match(/sym='([^']+)'/);
      const sym = m ? m[1] : "?";
      bySym[sym] = (bySym[sym] || 0) + 1;
      total++;
    }
    const items = Object.entries(bySym).map(([sym, count]) => ({ sym, count }));
    items.sort((a, b) => b.count - a.count);
    return { total, items, list };
  }, [parserData]);

  // ------- contexto para la IA -------
  const aiContext = {
    grammar,
    precedence,
    terminals,
    isBlocked,
    ambiguity: parserData?.ambiguity,
    suggestedLevels: suggested,
  };

  // ------- UI: panel de ambigüedad -------
  const AmbiguityPanel = () => {
    const amb = parserData?.ambiguity;
    if (!amb || amb.is_lr1) return null;

    return (
      <Card className="border border-amber-200 bg-amber-50/60 backdrop-blur-sm">
        <CardHeader className="py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-base text-amber-800">Conflictos LR(1) detectados</CardTitle>
          </div>
          <CardDescription className="text-xs text-amber-800/80">
            La tabla está bloqueada hasta que definas precedencia/asociatividad o ajustes la gramática.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Tabla bloqueada</span>
            <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
              Conflictos: {conflictSummary.total}
            </span>
            {conflictSummary.items.map(({ sym, count }) => (
              <span key={sym} className="px-2 py-1 rounded text-xs bg-white border border-slate-200 text-slate-700">
                {sym}: {count}
              </span>
            ))}
          </div>

          {Array.isArray(amb.hints) && amb.hints.length > 0 && (
            <div className="bg-white/70 border border-slate-200 rounded p-3">
              <div className="text-sm font-medium mb-2">Sugerencias</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {amb.hints.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {(suggested && suggested.length > 0) && (
            <div className="bg-white/70 border border-slate-200 rounded p-3">
              <div className="text-sm font-medium mb-2">Niveles sugeridos (menor → mayor)</div>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {suggested.map((lvl, i) => (
                  <li key={i}>
                    <span className="font-semibold">Nivel {i}</span>{" "}
                    <span className="uppercase tracking-wide text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {lvl.assoc}
                    </span>{" "}
                    : {lvl.tokens.join(", ")}
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPrecedence(suggested as any);
                    setTimeout(() => runBuild(), 0);
                  }}
                >
                  <Wand2 className="w-4 h-4 mr-1" />
                  Aplicar sugerencia y reconstruir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrecedence([
                      { assoc: "left", tokens: ["+", "-"] },
                      { assoc: "left", tokens: ["*", "/"] },
                      { assoc: "right", tokens: ["^"] },
                    ]);
                    setTimeout(() => runBuild(), 0);
                  }}
                >
                  Preset expresiones
                </Button>
              </div>
            </div>
          )}

          {conflictSummary.list.length > 0 && (
            <details className="bg-white/60 border border-slate-200 rounded p-3">
              <summary className="cursor-pointer text-sm font-medium">Ver detalle de conflictos</summary>
              <ul className="mt-2 list-disc pl-5 text-xs space-y-1 text-slate-700">
                {conflictSummary.list.map((c, i) => (<li key={i}>{c}</li>))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold mb-4 shadow-lg">
            <Sparkles className="w-4 h-4" />
            Compiler Design Tool
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Analizador Sintáctico LR(1)
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Construye parsers LR(1), AFN y DFA. Python (backend) + Next.js (frontend).
          </p>
        </div>

        {/* Main */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Gramática */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <FileText className="w-5 h-5" />
                Gramática
              </CardTitle>
              <CardDescription className="text-slate-600">
                Define las reglas de producción de tu gramática
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <GrammarInput value={grammar} onChange={setGrammar} disabled={isLoading} />

              <PrecedenceEditor terminals={terminals} value={precedence} onChange={setPrecedence} />

              {parserData?.desugared_preview && (
                <Card className="bg-white/70 border border-slate-200">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Gramática desambiguada (preview)</CardTitle>
                    <CardDescription className="text-xs">
                      Vista informativa generada a partir de los niveles de precedencia. No reemplaza tu gramática original.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-slate-50 p-3 rounded border border-slate-200">
                      {parserData.desugared_preview}
                    </pre>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  onClick={() =>
                    setPrecedence([
                      { assoc: "left", tokens: ["+", "-"] },
                      { assoc: "left", tokens: ["*", "/"] },
                      { assoc: "right", tokens: ["^"] },
                    ])
                  }
                  variant="outline"
                  disabled={isLoading}
                >
                  Preset expresiones
                </Button>
                <Button onClick={() => setPrecedence([])} variant="outline" disabled={isLoading}>
                  Limpiar
                </Button>
                <Button
                  variant={autoBuild ? "default" : "outline"}
                  onClick={() => setAutoBuild(v => !v)}
                  className="ml-auto"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${autoBuild ? "animate-spin" : ""}`} />
                  {autoBuild ? "Reconstrucción automática ON" : "Reconstrucción automática OFF"}
                </Button>
              </div>

              <Button
                onClick={runBuild}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 animate-spin" />
                    Construyendo...
                  </span>
                ) : (
                  "Construir Parser"
                )}
              </Button>

              {parserData && !isBlocked && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-700">
                    Parser LR(1) construido sin conflictos
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cadena de Entrada */}
          <Card className="lg:col-span-1 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <Play className="w-5 h-5" />
                Cadena de Entrada
              </CardTitle>
              <CardDescription className="text-slate-600">
                Ingresa la cadena que deseas analizar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <Input
                defaultValue="id + id * id"
                onChange={(e) => setInputString(e.target.value)}
                placeholder="Ej: id + id * id"
                disabled={isLoading || !parserData || isBlocked}
                className="font-mono text-base border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
              <Button
                onClick={handleParse}
                disabled={isLoading || !parserData || isBlocked || !inputString.trim() }
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duración-200 font-semibold"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Play className="w-4 h-4 animate-pulse" />
                    Analizando...
                  </span>
                ) : (
                  "Analizar Cadena"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {parserData && (
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="grid w-full bg-white/80 backdrop-blur-sm grid-cols-5 border border-slate-200 rounded-xl overflow-hidden shadow-md p-1">
              <TabsTrigger value="table" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg">
                <Table className="w-4 h-4 mr-2" />
                Tabla LR(1)
              </TabsTrigger>
              <TabsTrigger value="steps" disabled={!parsingResult || isBlocked} className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg">
                <GitBranch className="w-4 h-4 mr-2" />
                Pasos
              </TabsTrigger>
              <TabsTrigger value="nfa" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg">
                <Workflow className="w-4 h-4 mr-2" />
                AFN
              </TabsTrigger>
              <TabsTrigger value="dfa" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg">
                <Workflow className="w-4 h-4 mr-2" />
                DFA
              </TabsTrigger>
              <TabsTrigger value="comparison" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg">
                Comparación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-6 space-y-6">
              <AmbiguityPanel />
              {!isBlocked ? (
                <ParsingTable parserData={parserData} />
              ) : (
                <Card className="border border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="py-10 text-center">
                    <p className="text-slate-700 font-medium">
                      Aplica una sugerencia de precedencia o ajusta la gramática; la tabla se generará cuando no haya conflictos.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="steps" className="mt-6">
              {!isBlocked && parsingResult && <ParsingSteps result={parsingResult} />}
            </TabsContent>

            <TabsContent value="nfa" className="mt-6">
              {nfa ? (
                <AutomatonVisualizer automaton={nfa} title="AFN" description="Autómata Finito No Determinista" />
              ) : (
                <Card className="border border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="text-center py-16">
                    <Workflow className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">Construye el parser primero para generar el AFN</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="dfa" className="mt-6">
              {dfa ? (
                <AutomatonVisualizer automaton={dfa} title="DFA" description="Autómata Finito Determinista" />
              ) : (
                <Card className="border border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="text-center py-16">
                    <Workflow className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">Construye el parser primero para generar el DFA</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="mt-6">
              {nfa && dfa ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <AutomatonVisualizer automaton={nfa} title="AFN" description="Autómata No Determinista" />
                  <AutomatonVisualizer automaton={dfa} title="DFA" description="Autómata Determinista" />
                </div>
              ) : (
                <Card className="border border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="text-center py-16">
                    <Workflow className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">
                      Construye el parser primero para comparar AFN y DFA
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <FloatingChat context={aiContext} title="Asistente LR(1)" />
    </div>
  );
}
