import React from 'react';
import { CheckCircle, XCircle, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';

interface ParsingStepsProps {
  result: {
    success: boolean;
    steps: Array<{ step: number; stack: number[]; symbols: string[]; input: string[]; action: string }>;
    error?: string;
    message?: string;
  };
}

export function ParsingSteps({ result }: ParsingStepsProps) {
  // Función para determinar el tipo de acción
  const getActionType = (action: string) => {
    if (action.startsWith('d')) return 'shift';
    if (action.startsWith('r')) return 'reduce';
    if (action === 'accept' || action === 'aceptar') return 'accept';
    return 'other';
  };

  // Función para obtener el estilo del badge según la acción
  const getActionStyle = (action: string) => {
    const type = getActionType(action);
    const styles = {
      shift: 'bg-blue-100 text-blue-700 border-blue-300',
      reduce: 'bg-orange-100 text-orange-700 border-orange-300',
      accept: 'bg-green-100 text-green-700 border-green-300',
      other: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return styles[type];
  };

  // Función para obtener el ícono de la acción
  const getActionIcon = (action: string) => {
    const type = getActionType(action);
    if (type === 'shift') return <ArrowUp className="w-3 h-3" />;
    if (type === 'reduce') return <ArrowDown className="w-3 h-3" />;
    if (type === 'accept') return <CheckCircle className="w-3 h-3" />;
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 shadow-sm rounded-lg">
      <div className="p-6 pb-4 border-b border-slate-200">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          Pasos de Análisis
        </h3>
        <div className="flex gap-2">
          <span 
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              result.success 
                ? "bg-green-500 text-white" 
                : "bg-red-500 text-white"
            }`}
          >
            {result.success ? "Aceptada" : "Rechazada"}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-300 text-slate-700">
            {result.steps.length} pasos
          </span>
        </div>
      </div>
      
      <div className="p-6">
        {result.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-red-700 text-sm font-medium">{result.error}</p>
          </div>
        )}
        
        {result.message && result.success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-green-700 text-sm font-medium">{result.message}</p>
          </div>
        )}

        <div className="space-y-2">
          {result.steps.map((s, i) => (
            <div 
              key={i} 
              className="group relative flex items-center gap-3 p-4 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200"
            >
              {/* Número de paso */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{s.step}</span>
                </div>
              </div>

              {/* Contenido principal */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Pila Combinada (Estados + Símbolos) */}
                <div className="space-y-1 md:col-span-1">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Pila
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.stack.map((state, idx) => (
                      <div 
                        key={idx}
                        className="inline-flex flex-col items-center bg-slate-50 border border-slate-200 rounded px-2 py-1"
                      >
                        <span className="text-[10px] font-mono text-slate-600">{s.symbols[idx] || ''}</span>
                        <span className="text-xs font-mono font-bold text-slate-800">{state}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Entrada */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Entrada
                  </div>
                  <code className="block text-xs font-mono bg-amber-50 px-2 py-1.5 rounded border border-amber-200 text-amber-900">
                    {s.input.join(" ")}
                  </code>
                </div>

                {/* Acción */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Acción
                  </div>
                  <span 
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${getActionStyle(s.action)}`}
                  >
                    {getActionIcon(s.action)}
                    {s.action}
                  </span>
                </div>
              </div>

              {/* Flecha de continuación */}
              {i < result.steps.length - 1 && (
                <div className="flex-shrink-0 hidden md:block">
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}