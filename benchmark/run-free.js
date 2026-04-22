const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const prompts = require("./prompts");
const RULES = fs.readFileSync(path.join(__dirname, "..", "WHISPERS.md"), "utf8");

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

async function gemini(apiKey, model, prompt, system) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${t || res.statusText}`);
  }

  const j = await res.json();
  const outTok = j?.usageMetadata?.candidatesTokenCount ?? 0;
  return { outTok, j };
}

async function main() {
  const apiKey = reqEnv("GEMINI_API_KEY");
  const model = "gemini-1.5-flash";

  const rows = [];
  let sumN = 0;
  let sumW = 0;

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];

    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(`Running ${i + 1}/${prompts.length}...`);

    const normal = await gemini(apiKey, model, p, "You are a helpful coding assistant.");
    await sleep(400);
    const whispers = await gemini(apiKey, model, p, `You are a helpful coding assistant.\n\n${RULES}`);

    const nt = normal.outTok;
    const wt = whispers.outTok;
    const sv = nt - wt;
    rows.push({ task: `#${i + 1}`, nt, wt, sv, p: pct(sv, nt) });
    sumN += nt;
    sumW += wt;

    await sleep(400);
  }

  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);

  const wTask = 6;
  const wN = 14;
  const wW = 15;
  const wSaved = 8;
  const wPct = 5;

  console.log(
    `${pad("Task", wTask)} | ${padL("Normal tokens", wN)} | ${padL("whispers tokens", wW)} | ${padL("Saved", wSaved)} | ${padL("%", wPct)}`
  );
  console.log(`${"-".repeat(wTask)}-+-${"-".repeat(wN)}-+-${"-".repeat(wW)}-+-${"-".repeat(wSaved)}-+-${"-".repeat(wPct)}`);

  for (const r of rows) {
    console.log(
      `${pad(r.task, wTask)} | ${padL(r.nt, wN)} | ${padL(r.wt, wW)} | ${padL(r.sv, wSaved)} | ${padL(r.p, wPct)}`
    );
  }

  const saved = sumN - sumW;
  const avg = sumN ? Math.round((saved / sumN) * 100) : 0;
  console.log(`${"-".repeat(wTask + wN + wW + wSaved + wPct + 12)}`);
  console.log(`Average reduction: ${avg}%`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

