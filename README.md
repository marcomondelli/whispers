# whispers

> Few tokens. Do trick.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`whispers` is a **drop-in compression skill for Claude Code**.
It reduces response tokens by stripping filler/hedging and preferring fragments + lists, while **preserving technical content** (code blocks, file paths, URLs, identifiers, errors).

This repo includes:
- `WHISPERS.md` rules file (the skill)
- `CLAUDE.md` example auto-loader
- Node scripts to **measure tokens** and run **reproducible benchmarks**

---

## Quickstart

1. Copy `WHISPERS.md` into your Claude Code project
2. Add this line to your project’s `CLAUDE.md`:

```md
Load the rules in `WHISPERS.md` for all responses.
```

3. Start a new session. Use:
- `whispers` (default)
- `whispers lite`
- `whispers ultra`
- `whispers off`

## How it works

Claude Code sees `WHISPERS.md` in context and applies its communication rules to every response:

- Remove filler openers / sign-offs / throat-clearing
- Remove hedging
- Prefer fragments + lists when possible
- **Never alter technical payload** (code blocks untouched, paths/URLs preserved)

No plugins. No build step. Prompt engineering only.

## What this is / isn’t

- ✅ **Is**: a consistent style layer that reduces verbosity and token usage
- ✅ **Is**: measurable via benchmarks and token counters
- ❌ **Isn’t**: a guarantee — compliance varies by model, prompt, and context size

## Benchmarks (API, reproducible)

There are 3 benchmark runners in `benchmark/`:

- **Anthropic Claude**: `node run.js` (requires `ANTHROPIC_API_KEY`)
- **Groq** (fast, OpenAI-compatible): `node run-groq.js` (requires `GROQ_API_KEY`) — *not Claude*
- **Gemini Flash**: `node run-free.js` (requires `GEMINI_API_KEY`)

All runners execute each prompt twice:

1. Normal system prompt
2. System prompt + `WHISPERS.md`

Then print an aligned table and average % reduction.

### Results table (fill after running)

Groq sample run (model: `llama-3.1-8b-instant`):

| Task                           | Normal tokens | whispers tokens | Saved | %    |
| ------------------------------ | ------------: | -------------: | ----: | ---: |
| React hooks explanation        |           578 |            465 |   113 |  20% |
| Fix undefined variable (code)  |           216 |            257 |   -41 | -19% |
| Git merge vs rebase            |           450 |            347 |   103 |  23% |
| CSS centering (code)           |           301 |            383 |   -82 | -27% |
| Node retry with backoff (code) |           615 |            595 |    20 |   3% |
| SQL join explanation           |           636 |            145 |   491 |  77% |
| Docker multi-stage build       |           491 |            454 |    37 |   8% |

Average reduction: **20%** (this run).

> **Transparency**: do not treat any % as universal. Savings depend heavily on task type (explanations compress more than code-only answers).

## Usage

| Command | Effect |
|---|---|
| `whispers lite` | strip filler only, keep grammar |
| `whispers` / `whispers full` | fragments + drop articles when clear (default) |
| `whispers ultra` | maximum compression |
| `whispers off` | deactivate |

## Before / after (same fix, fewer tokens)

**Normal** (verbose):

> Great question! I'd be happy to help you debug the re-render. It's worth noting that React re-renders when state or props change. You may want to consider wrapping the child with `React.memo` so that it doesn't re-render unnecessarily. Here's how you would do it:
>
> ```jsx
> export default React.memo(Child);
> ```
>
> Let me know if you have any questions!

**whispers**:

> Re-render cause: parent re-renders, child props change ref.
> Fix: memoize.
> ```jsx
> export default React.memo(Child);
> ```

## Scripts (local measurement)

```bash
cd scripts
npm install
node whispers-inspect.js paste     # count tokens in pasted text (stdin)
node whispers-inspect.js session   # compare WITHOUT vs WITH (separator: ----)
node cursor-inspect.js             # scan local Cursor DBs and estimate savings
```

Notes:
- `whispers-inspect` uses `tiktoken` (`cl100k_base`) if present, otherwise a char/4 approximation.
- `cursor-inspect` reads Cursor’s `state.vscdb` files read-only. Cursor’s internal schema may change; extraction is best-effort.

## Reproduce benchmarks

```bash
cd benchmark
cp .env.example .env
npm install
```

Anthropic:

```bash
# set ANTHROPIC_API_KEY in .env
node run.js
```

Groq:

```bash
# set GROQ_API_KEY in .env
# optional: set GROQ_MODEL=... (default: llama-3.1-8b-instant)
# optional (helps avoid 429 rate limits):
#   GROQ_DELAY_MS=1200
#   GROQ_MAX_TOKENS=400
node run-groq.js
```

Gemini:

```bash
# set GEMINI_API_KEY in .env
node run-free.js
```

## Honesty & limits

- **Prompt, not a guarantee.** Different models follow “be terse” rules with different strictness.
- **Token counting differs by provider.** Compare runs within the same runner, not across vendors.
- **Benchmarks are representative, not exhaustive.** Add your own prompts in `benchmark/prompts.js` and publish your table.
- **No code modification.** `WHISPERS.md` is explicitly written to keep code blocks and technical strings intact.

## Related

- [`bonsai`](https://github.com/marcomondelli/bonsai) — Cursor rules that reduce verbosity by default.

## License

MIT

## Security

- Never commit `.env` files.
- If you accidentally leaked an API key, rotate it immediately and purge it from git history before publishing.
- See `SECURITY.md`.

## Publishing this repo (important)

If your current git repo is rooted somewhere above this folder (e.g. your home directory), do **not** publish that whole repo.

Publish **only** this directory (`whispers/`) as its own repository.
