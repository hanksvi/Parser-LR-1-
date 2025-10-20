// app/api/run-script/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || path.join(ROOT, "src");
const RAW_PY = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

const isWin = process.platform === "win32";
const isWindowsPath = (p: string) => /^[A-Za-z]:\\/.test(p);
const isMntPath = (p: string) => p.startsWith("/mnt/");
const isLinuxAbs = (p: string) => p.startsWith("/");

function resolvePythonInvoker(rawPy: string): { cmd: string; baseArgs: string[] } {
  if (!isWin) return { cmd: rawPy, baseArgs: [] };                 // Linux/WSL
  if (isWindowsPath(rawPy)) return { cmd: rawPy, baseArgs: [] };   // C:\...\python.exe
  if (isMntPath(rawPy) || isLinuxAbs(rawPy)) {                     // /mnt/... -> usar WSL
    const fixed = rawPy.replace(/\\/g, "/");
    return { cmd: "wsl", baseArgs: [fixed] };
  }
  return { cmd: rawPy, baseArgs: [] };                             // "python" en PATH de Windows
}

const ALLOWED: Record<string, string> = {
  "lr1_parser.py": path.join(SCRIPTS_DIR, "lr1_adapter.py"),
  "automaton_builder.py": path.join(SCRIPTS_DIR, "automaton_adapter.py"),
};

export async function GET() {
  const { cmd, baseArgs } = resolvePythonInvoker(RAW_PY);
  return NextResponse.json({
    ok: true,
    platform: process.platform,
    PYTHON_BIN: RAW_PY,
    invoker: cmd,
    baseArgs,
    cwd: ROOT,
    scripts_dir: SCRIPTS_DIR,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { script, args = [] } = await req.json();

    const real = ALLOWED[script as keyof typeof ALLOWED];
    if (!real) return NextResponse.json({ success: false, error: "Script no permitido" }, { status: 400 });
    if (!fs.existsSync(real)) {
      return NextResponse.json({ success: false, error: `No existe el archivo: ${real}` }, { status: 404 });
    }

    const { cmd, baseArgs } = resolvePythonInvoker(RAW_PY);
    const spawnArgs = [...baseArgs, "-u", real, ...args];

    const child = spawn(cmd, spawnArgs, {
      cwd: isWindowsPath(SCRIPTS_DIR) ? SCRIPTS_DIR : ROOT,
      shell: false,
      env: process.env,
    });

    let out = "", err = "";
    child.stdout.on("data", d => (out += d.toString()));
    child.stderr.on("data", d => (err += d.toString()));

    const code: number = await new Promise(res => child.on("close", res));

    if (code === 0) {
      try { return NextResponse.json(JSON.parse(out)); }
      catch { return NextResponse.json({ success: true, raw: out }); }
    }
    return NextResponse.json(
      { success: false, error: err || "Fallo al ejecutar Python", debug: { cmd, args: spawnArgs } },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
