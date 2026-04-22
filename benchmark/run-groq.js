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

function parseRetryAfterSeconds(res, bodyText) {
  const h = res.headers?.get?.("retry-after");
  if (h) {
    const n = Number(h);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Groq error often includes: "Please try again in 5.56s."
  const m = /try again in\s+(\d+(?:\.\d+)?)s/i.exec(bodyText || "");
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

async function groq(apiKey, model, prompt, system) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: Number(process.env.GROQ_MAX_TOKENS || 700)
  };

  const maxRetries = Number(process.env.GROQ_RETRIES || 6);
  const baseDelayMs = Number(process.env.GROQ_RETRY_BASE_MS || 750);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const j = await res.json();
      const outTok = j?.usage?.completion_tokens ?? j?.usage?.completionTokens ?? 0;
      return { outTok, j };
    }

    const t = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status === 408 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504;
    if (!retryable || attempt === maxRetries) {
      throw new Error(`Groq API error ${res.status}: ${t || res.statusText}`);
    }

    const retryAfterS = parseRetryAfterSeconds(res, t);
    const backoffMs = Math.round(baseDelayMs * Math.pow(2, attempt));
    const waitMs = Math.max(250, retryAfterS ? Math.ceil(retryAfterS * 1000) : backoffMs);
    await sleep(waitMs);
  }
}

async function main() {
  const apiKey = reqEnv("GROQ_API_KEY");
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const perCallDelayMs = Number(process.env.GROQ_DELAY_MS || 350);

  const rows = [];
  let sumN = 0;
  let sumW = 0;

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];

    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(`Running ${i + 1}/${prompts.length}...`);

    const normal = await groq(apiKey, model, p, "You are a helpful coding assistant.");
    await sleep(perCallDelayMs);
    const whispers = await groq(apiKey, model, p, `You are a helpful coding assistant.\n\n${RULES}`);

    const nt = normal.outTok;
    const wt = whispers.outTok;
    const sv = nt - wt;
    rows.push({ task: `#${i + 1}`, nt, wt, sv, p: pct(sv, nt) });
    sumN += nt;
    sumW += wt;

    await sleep(perCallDelayMs);
  }

  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);

  const wTask = 6;
  const wN = 14;
  const wW = 15;
  const wSaved = 8;
  const wPct = 5;

  console.log(`Model: ${model}`);
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

