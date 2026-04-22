const os = require("os");
const path = require("path");
const fs = require("fs");
const { countTokens } = require("./_token");

function homedir(p) {
  if (!p.startsWith("~")) return p;
  return path.join(os.homedir(), p.slice(1));
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(p, d.name));
  } catch {
    return [];
  }
}

function findDbPaths() {
  const plat = process.platform;
  let base;
  if (plat === "darwin") base = homedir("~/Library/Application Support/Cursor/User/workspaceStorage");
  else if (plat === "win32") base = path.join(process.env.APPDATA || "", "Cursor", "User", "workspaceStorage");
  else base = homedir("~/.config/Cursor/User/workspaceStorage");

  const dirs = listDirs(base);
  return dirs.map((d) => path.join(d, "state.vscdb")).filter((p) => exists(p));
}

function walk(x, out) {
  if (!x) return;
  if (Array.isArray(x)) {
    for (const v of x) walk(v, out);
    return;
  }
  if (typeof x !== "object") return;

  if (typeof x.role === "string" && typeof x.content === "string") out.push({ role: x.role, content: x.content });

  for (const k of Object.keys(x)) walk(x[k], out);
}

function extractRoleContent(v) {
  const out = [];
  try {
    const j = JSON.parse(v);
    walk(j, out);
    return out;
  } catch {
    return out;
  }
}

function pad(s, n) {
  return String(s).padEnd(n, " ");
}

function padL(s, n) {
  return String(s).padStart(n, " ");
}

function main() {
  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    console.error("Missing dependency: better-sqlite3");
    console.error("Run:\n  npm install\nin scripts/ directory.");
    process.exit(1);
  }

  const dbs = findDbPaths();
  if (!dbs.length) {
    console.log("No Cursor workspace DBs found.");
    process.exit(0);
  }

  const q =
    "SELECT value FROM ItemTable WHERE key LIKE '%chat%' OR key LIKE '%conversation%' OR key LIKE '%composer%'";

  let totalMsgs = 0;
  let totalAsstTokens = 0;

  const rows = [];

  for (const p of dbs) {
    let db;
    try {
      db = new Database(p, { readonly: true, fileMustExist: true });
    } catch {
      continue;
    }

    let vals;
    try {
      vals = db.prepare(q).all();
    } catch {
      db.close?.();
      continue;
    }

    const msgs = [];
    for (const r of vals) {
      if (!r || typeof r.value !== "string") continue;
      const extracted = extractRoleContent(r.value);
      for (const m of extracted) msgs.push(m);
    }

    const asst = msgs.filter((m) => m.role === "assistant").map((m) => m.content);
    let sum = 0;
    for (const t of asst) sum += countTokens(t).n;

    const msgCount = msgs.length;
    const avgAsst = asst.length ? Math.round(sum / asst.length) : 0;

    rows.push({ p, msgCount, avgAsst, asstCount: asst.length, sum });

    totalMsgs += msgCount;
    totalAsstTokens += sum;

    db.close?.();
  }

  const wName = 10;
  const wMsgs = 12;
  const wAvg = 18;

  console.log(`${pad("Workspace", wName)} | ${padL("messages", wMsgs)} | ${padL("avg assistant tokens", wAvg)}`);
  console.log(`${"-".repeat(wName)}-+-${"-".repeat(wMsgs)}-+-${"-".repeat(wAvg)}`);

  let i = 1;
  for (const r of rows) {
    console.log(`${pad(`#${i++}`, wName)} | ${padL(r.msgCount, wMsgs)} | ${padL(r.avgAsst, wAvg)}`);
  }

  console.log("");
  console.log(`Total messages: ${totalMsgs}`);
  console.log(`Total assistant tokens (sum): ${totalAsstTokens}`);
  console.log(`Projected saving at 65%: ${Math.round(totalAsstTokens * 0.65)}`);
}

main();

