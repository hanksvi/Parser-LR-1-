"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { TreePine } from "lucide-react";

interface ParseTreeProps {
  result: { success: boolean; tree?: any };
}

export function ParseTree({ result }: ParseTreeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="w-5 h-5" />
          Árbol de Análisis Sintáctico
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.success ? (
          <div className="text-center py-12">
            <TreePine className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Visualización del árbol de análisis próximamente…</p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">No se puede generar el árbol para una cadena rechazada</div>
        )}
      </CardContent>
    </Card>
  );
}
