function approxTokens(s) {
  return Math.round((s || "").length / 4);
}

function tryTiktoken() {
  try {
    // eslint-disable-next-line global-require
    const t = require("tiktoken");
    if (typeof t.get_encoding === "function") return { kind: "py", t };
    if (typeof t.encoding_for_model === "function") return { kind: "model", t };
    return { kind: "unknown", t };
  } catch {
    return null;
  }
}

function countTokens(text) {
  const s = String(text || "");
  const mod = tryTiktoken();
  if (!mod) return { n: approxTokens(s), via: "approx" };

  try {
    let enc;
    if (mod.kind === "py") enc = mod.t.get_encoding("cl100k_base");
    else if (mod.kind === "model") enc = mod.t.encoding_for_model("gpt-4");
    else enc = mod.t.get_encoding?.("cl100k_base");
    if (!enc) return { n: approxTokens(s), via: "approx" };
    const ids = enc.encode(s);
    const n = ids.length;
    enc.free?.();
    return { n, via: "tiktoken" };
  } catch {
    return { n: approxTokens(s), via: "approx" };
  }
}

module.exports = { countTokens, approxTokens };

