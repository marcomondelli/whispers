## Contributing

### Quick guidelines

- Keep `WHISPERS.md` rules compact and deterministic.
- Never change or “pretty up” code blocks in examples; treat them as immutable payload.
- Prefer minimal diffs in scripts; runners should stay simple and reproducible.

### Development

```bash
cd benchmark
npm install
cp .env.example .env
node run.js
node run-groq.js
node run-free.js
```

### Pull requests

- Add/adjust prompts in `benchmark/prompts.js` when behavior changes
- Include before/after output snippet in PR description
- No secrets in commits (`.env` must stay local)

