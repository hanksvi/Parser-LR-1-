"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { Table2, Eye, EyeOff, ListOrdered } from "lucide-react";

export function ParsingTable({ parserData }: { parserData: any }) {
  const td = parserData?.table_data;

  if (!td || !td.terminals || !td.non_terminals || !td.states || !td.productions) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
          <CardTitle className="flex items-center gap-2 text-indigo-700">
            <Table2 className="w-5 h-5" />
            Tabla de Análisis LR(1)
          </CardTitle>
        </CardHeader>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Table2 className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">
            No hay datos de tabla disponibles. Construye el parser o revisa errores.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { terminals, non_terminals, states, productions } = td;
  const [showProductions, setShowProductions] = useState(true);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
        <CardTitle className="flex items-center gap-2 text-indigo-700">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Table2 className="w-5 h-5 text-white" />
          </div>
          Tabla de Análisis LR(1)
        </CardTitle>
        <div className="flex gap-2 flex-wrap mt-2">
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold">
            {states.length} estados
          </Badge>
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-semibold">
            {terminals.length} terminales
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold">
            {non_terminals.length} no terminales
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Toggle de producciones */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            className="bg-white hover:bg-indigo-50 border-indigo-200 text-indigo-700 hover:text-indigo-800 hover:border-indigo-300 transition-all"
            onClick={() => setShowProductions(!showProductions)}
          >
            {showProductions ? (
              <>
                <EyeOff className="w-4 h-4 mr-1.5" />
                Ocultar producciones
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1.5" />
                Mostrar producciones
              </>
            )}
          </Button>
        </div>

        {/* Lista de producciones */}
        <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200">
          <h4 className="font-semibold mb-3 text-slate-700 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-indigo-600" />
            Producciones de la Gramática
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {productions.map((p: string, i: number) => (
              <div
                key={i}
                className="font-mono bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mr-2">
                  {i}
                </span>
                <span className="text-slate-800">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla LR(1) con scroll */}
        <div className="overflow-auto rounded-xl border-2 border-slate-200 shadow-lg max-h-[600px]">
          <table className="w-full border-collapse text-sm relative">
            <thead className="sticky top-0 z-20">
              <tr className="border-b-2 border-slate-300">
                <th className="p-3 text-left font-bold text-indigo-700 border-r-2 border-slate-300 bg-gradient-to-br from-indigo-50 to-blue-50 sticky left-0 z-30">
                  Estado
                </th>
                {terminals.map((t: string, idx: number) => (
                  <th
                    key={t}
                    className={`p-3 text-center font-bold text-orange-700 bg-gradient-to-br from-orange-50 to-amber-50 ${
                      idx < terminals.length - 1 ? "border-r border-orange-200" : "border-r-2 border-slate-300"
                    }`}
                  >
                    <span className="inline-block px-2 py-1 rounded-md bg-white/50">
                      {t}
                    </span>
                  </th>
                ))}
                {non_terminals.map((nt: string, idx: number) => (
                  <th
                    key={nt}
                    className={`p-3 text-center font-bold text-purple-700 bg-gradient-to-br from-purple-50 to-violet-50 ${
                      idx < non_terminals.length - 1 ? "border-r border-purple-200" : ""
                    }`}
                  >
                    <span className="inline-block px-2 py-1 rounded-md bg-white/50">
                      {nt}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {states.map((s: any, rowIdx: number) => (
                <tr
                  key={s.state}
                  className={`border-b border-slate-200 hover:bg-indigo-50/50 transition-colors ${
                    rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="p-3 font-mono font-bold align-top border-r-2 border-slate-300 bg-gradient-to-r from-indigo-50/50 to-transparent sticky left-0 z-10 bg-white">
                    <div className="flex flex-col">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white text-sm font-bold mb-2">
                        {s.state}
                      </span>
                      {showProductions && s.items && (
                        <div className="text-xs text-slate-600 mt-2 space-y-1 pl-1 border-l-2 border-indigo-200">
                          {s.items.map((it: string, idx: number) => (
                            <div key={idx} className="font-mono pl-2 py-0.5">
                              {it}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {terminals.map((t: string, idx: number) => (
                    <td 
                      key={t} 
                      className={`p-3 text-center align-top ${
                        idx < terminals.length - 1 ? "border-r border-slate-100" : "border-r-2 border-slate-300"
                      }`}
                    >
                      {s[t] && <ActionCell action={s[t]} />}
                    </td>
                  ))}

                  {non_terminals.map((nt: string, idx: number) => (
                    <td 
                      key={nt} 
                      className={`p-3 text-center align-top ${
                        idx < non_terminals.length - 1 ? "border-r border-slate-100" : ""
                      }`}
                    >
                      {s[nt] && (
                        <span className="inline-block px-2 py-1 rounded-md bg-purple-100 text-purple-700 font-mono text-xs font-semibold border border-purple-200">
                          {s[nt]}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
          <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Leyenda de Acciones
          </h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-mono text-xs">
                d5
              </Badge>
              <span className="text-xs text-slate-600">Shift (desplazar)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-mono text-xs">
                r3
              </Badge>
              <span className="text-xs text-slate-600">Reduce (reducir)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 border-green-200 font-mono text-xs">
                acc
              </Badge>
              <span className="text-xs text-slate-600">Accept (aceptar)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-mono text-xs">
                7
              </Badge>
              <span className="text-xs text-slate-600">Goto (ir a estado)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCell({ action }: { action: string }) {
  const type =
    action?.startsWith?.("d") ? "shift" :
    action?.startsWith?.("r") ? "reduce" :
    action === "acc" ? "accept" : "goto";

  const styles = {
    shift: "bg-blue-100 text-blue-800 border-blue-300 shadow-sm",
    reduce: "bg-orange-100 text-orange-800 border-orange-300 shadow-sm",
    accept: "bg-green-100 text-green-800 border-green-300 shadow-sm font-bold",
    goto: "bg-slate-100 text-slate-700 border-slate-300"
  };

  return (
    <Badge
      className={`font-mono text-xs px-2.5 py-1 border ${styles[type]} hover:scale-105 transition-transform`}
    >
      {action}
    </Badge>
  );
}