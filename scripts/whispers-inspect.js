const readline = require("readline");
const { countTokens } = require("./_token");

function readAllStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    const lines = [];
    rl.on("line", (l) => lines.push(l));
    rl.on("close", () => resolve(lines.join("\n")));
  });
}

async function readTwoStdinBlocks() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    const blocks = ["", ""];
    let idx = 0;
    let cur = [];
    rl.on("line", (l) => {
      if (l === "----" && idx === 0) {
        blocks[0] = cur.join("\n");
        cur = [];
        idx = 1;
        return;
      }
      cur.push(l);
    });
    rl.on("close", () => {
      blocks[idx] = cur.join("\n");
      resolve(blocks);
    });
  });
}

function words(s) {
  const t = String(s || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function padL(s, n) {
  return String(s).padStart(n, " ");
}

function pct(saved, base) {
  if (!base) return "0%";
  return `${Math.round((saved / base) * 100)}%`;
}

function proj(n, level) {
  const m = { lite: 0.75, full: 0.5, ultra: 0.35 }[level] ?? 0.5;
  return Math.max(0, Math.round(n * m));
}

async function main() {
  const mode = (process.argv[2] || "").toLowerCase();

  if (mode !== "paste" && mode !== "session") {
    console.error("Usage:\n  node whispers-inspect.js paste\n  node whispers-inspect.js session");
    console.error("\nSession input format: paste WITHOUT, then a line with '----', then paste WITH, then Ctrl+D.");
    process.exit(1);
  }

  if (mode === "paste") {
    const t = await readAllStdin();
    const tk = countTokens(t);
    const w = words(t);
    console.log(`tokens: ${tk.n} (${tk.via})`);
    console.log(`words:  ${w}`);
    console.log("");
    console.log(`projected tokens (lite):  ${proj(tk.n, "lite")}`);
    console.log(`projected tokens (full):  ${proj(tk.n, "full")}`);
    console.log(`projected tokens (ultra): ${proj(tk.n, "ultra")}`);
    return;
  }

  const [a, b] = await readTwoStdinBlocks();
  const at = countTokens(a);
  const bt = countTokens(b);
  const sv = at.n - bt.n;

  console.log(`${padL("", 10)} | ${padL("tokens", 8)} | ${padL("saved", 8)} | ${padL("%", 4)}`);
  console.log(`${"-".repeat(10)}-+-${"-".repeat(8)}-+-${"-".repeat(8)}-+-${"-".repeat(4)}`);
  console.log(`${padL("without", 10)} | ${padL(at.n, 8)} | ${padL("", 8)} | ${padL("", 4)}`);
  console.log(`${padL("with", 10)} | ${padL(bt.n, 8)} | ${padL(sv, 8)} | ${padL(pct(sv, at.n), 4)}`);
  console.log("");
  console.log(sv > 0 ? "whispers working." : "no savings detected.");
  if (at.via !== bt.via) console.log(`note: tokenizer differed (${at.via} vs ${bt.via})`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

