"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { Button } from "@/app/ui/button";
import { Input } from "@/app/ui/input";
import { Badge } from "@/app/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/ui/tabs";
import { GrammarInput } from "./grammar-input";
import { ParsingTable } from "./parsing-table";
import { ParsingSteps } from "./parsing-steps";
import { ParseTree } from "./parse-tree";
import { AutomatonVisualizer } from "./automaton-visualizer";
import { Play, FileText, Table, Settings, GitBranch, Workflow, Sparkles, CheckCircle2 } from "lucide-react";

export function ParserInterface() {
  const [grammar, setGrammar] = useState(`S -> E
E -> E + T
E -> T
T -> T * F
T -> F
F -> ( E )
F -> id`);
  const [inputString, setInputString] = useState("id + id * id");
  const [parserData, setParserData] = useState<any>(null);
  const [parsingResult, setParsingResult] = useState<any>(null);
  const [nfa, setNfa] = useState<any>(null);
  const [dfa, setDfa] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuildParser = async () => {
    setIsLoading(true);
    setError(null);
    setNfa(null);
    setDfa(null);

    try {
      const parserResponse = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "lr1_parser.py",
          args: ["build", JSON.stringify({ grammar })],
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
          args: ["build_both", JSON.stringify({ grammar })],
        }),
      });

      const automatonResult = await automatonResponse.json();
      if (!automatonResponse.ok || !automatonResult.success) throw new Error(automatonResult.error || "Error construyendo AFN/DFA");
      setNfa(automatonResult.nfa);
      setDfa(automatonResult.dfa);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error building parser");
    } finally {
      setIsLoading(false);
    }
  };

  const handleParse = async () => {
    if (!parserData) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "lr1_parser.py",
          args: ["parse", JSON.stringify({ grammar, input: inputString })],
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
            Herramienta completa para construir parsers LR(1), AFN y DFA. Implementado con Python (backend) y Next.js (frontend).
          </p>
        </div>

        {/* Main */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Grammar */}
          <Card className="lg:col-span-1 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
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
              <Button
                onClick={handleBuildParser}
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
              {parserData && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-700">
                    Parser LR(1) construido exitosamente
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Input */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
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
                disabled={isLoading || !parserData}
                className="font-mono text-base border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
              <Button
                onClick={handleParse}
                disabled={isLoading || !parserData || !inputString.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
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

              {error && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {parserData && (
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="grid w-full bg-white/80 backdrop-blur-sm grid-cols-5 border border-slate-200 rounded-xl overflow-hidden shadow-md p-1">
              <TabsTrigger 
                value="table" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg"
              >
                <Table className="w-4 h-4 mr-2" />
                Tabla LR(1)
              </TabsTrigger>
              <TabsTrigger 
                value="steps" 
                disabled={!parsingResult} 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                Pasos
              </TabsTrigger>
              <TabsTrigger 
                value="nfa" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg"
              >
                <Workflow className="w-4 h-4 mr-2" />
                AFN
              </TabsTrigger>
              <TabsTrigger 
                value="dfa" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg"
              >
                <Workflow className="w-4 h-4 mr-2" />
                DFA
              </TabsTrigger>
              <TabsTrigger 
                value="comparison" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 font-medium rounded-lg"
              >
                Comparación
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-6">
              <ParsingTable parserData={parserData} />
            </TabsContent>

            <TabsContent value="steps" className="mt-6">
              {parsingResult && <ParsingSteps result={parsingResult} />}
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
    </div>
  );
}