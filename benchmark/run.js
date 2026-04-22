const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const prompts = require("./prompts");

const WHISPERS_RULES = fs.readFileSync(path.join(__dirname, "..", "WHISPERS.md"), "utf8");

function reqEnv(k) {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k}. Put it in benchmark/.env (see .env.example).`);
    process.exit(1);
  }
  return v;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pct(saved, base) {
  if (!base) return "0%";
  return `${Math.round((saved / base) * 100)}%`;
}

function pad(s, n) {
  return String(s).padEnd(n, " ");
}

function padL(s, n) {
  return String(s).padStart(n, " ");
}

async function main() {
  reqEnv("ANTHROPIC_API_KEY");

  let Anthropic;
  try {
    Anthropic = require("@anthropic-ai/sdk").Anthropic;
  } catch {
    console.error("Missing dependency. Run: npm install");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = "claude-3-5-haiku-20241022";

  const rows = [];
  let sumN = 0;
  let sumS = 0;

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];

    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(`Running ${i + 1}/${prompts.length}...`);

    const normal = await client.messages.create({
      model,
      max_tokens: 700,
      system: "You are a helpful coding assistant.",
      messages: [{ role: "user", content: p }]
    });

    await sleep(600);

    const stonk = await client.messages.create({
      model,
      max_tokens: 700,
      system: `You are a helpful coding assistant.\n\n${WHISPERS_RULES}`,
      messages: [{ role: "user", content: p }]
    });

    const nt = normal?.usage?.output_tokens ?? 0;
    const st = stonk?.usage?.output_tokens ?? 0;
    const sv = nt - st;
    rows.push({ task: `#${i + 1}`, nt, st, sv, pct: pct(sv, nt) });
    sumN += nt;
    sumS += st;

    await sleep(600);
  }

  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);

  const wTask = 6;
  const wN = 14;
  const wS = 15;
  const wSaved = 8;
  const wPct = 5;

  console.log(
    `${pad("Task", wTask)} | ${padL("Normal tokens", wN)} | ${padL("whispers tokens", wS)} | ${padL("Saved", wSaved)} | ${padL("%", wPct)}`
  );
  console.log(`${"-".repeat(wTask)}-+-${"-".repeat(wN)}-+-${"-".repeat(wS)}-+-${"-".repeat(wSaved)}-+-${"-".repeat(wPct)}`);

  for (const r of rows) {
    console.log(
      `${pad(r.task, wTask)} | ${padL(r.nt, wN)} | ${padL(r.st, wS)} | ${padL(r.sv, wSaved)} | ${padL(r.pct, wPct)}`
    );
  }

  const saved = sumN - sumS;
  const avg = sumN ? Math.round((saved / sumN) * 100) : 0;
  console.log(`${"-".repeat(wTask + wN + wS + wSaved + wPct + 12)}`);
  console.log(`Average reduction: ${avg}%`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

