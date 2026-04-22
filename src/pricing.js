// promptdiff — shared model pricing. 2026-04-22 snapshot.
// Same table as @v0idd0/tokcount and @v0idd0/ctxstuff so the three stay
// in sync. Each entry: { context, input, output, provider }. input/output
// are USD per 1,000,000 tokens. Prices drift monthly — run with the latest
// published version or check the provider for exact billing.

const MODELS = {
  // OpenAI
  'gpt-5.4':            { context:  400000, input:  2.50, output: 15.00, provider: 'openai' },
  'gpt-5.4-mini':       { context:  400000, input:  0.75, output:  4.50, provider: 'openai' },
  'gpt-5.4-nano':       { context:  400000, input:  0.20, output:  1.25, provider: 'openai' },
  'gpt-5':              { context:  400000, input:  1.25, output: 10.00, provider: 'openai' },
  'gpt-5-mini':         { context:  400000, input:  0.25, output:  2.00, provider: 'openai' },
  'gpt-5-nano':         { context:  400000, input:  0.05, output:  0.40, provider: 'openai' },
  'gpt-4.1':            { context: 1000000, input:  2.00, output:  8.00, provider: 'openai' },
  'gpt-4.1-mini':       { context: 1000000, input:  0.40, output:  1.60, provider: 'openai' },
  'gpt-4.1-nano':       { context: 1000000, input:  0.10, output:  0.40, provider: 'openai' },
  'gpt-4o':             { context:  128000, input:  2.50, output: 10.00, provider: 'openai' },
  'gpt-4o-mini':        { context:  128000, input:  0.15, output:  0.60, provider: 'openai' },
  'o3':                 { context:  200000, input:  2.00, output:  8.00, provider: 'openai' },
  'o3-mini':            { context:  200000, input:  1.10, output:  4.40, provider: 'openai' },
  'o4-mini':            { context:  200000, input:  1.10, output:  4.40, provider: 'openai' },

  // Anthropic
  'claude-opus-4-7':    { context: 1000000, input:  5.00, output: 25.00, provider: 'anthropic' },
  'claude-opus-4-6':    { context:  200000, input:  5.00, output: 25.00, provider: 'anthropic' },
  'claude-sonnet-4-6':  { context:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-haiku-4-5':   { context:  200000, input:  1.00, output:  5.00, provider: 'anthropic' },
  'claude-3.5-sonnet':  { context:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-3.5-haiku':   { context:  200000, input:  0.80, output:  4.00, provider: 'anthropic' },

  // Google
  'gemini-3.1-pro':     { context: 2000000, input:  2.00, output: 12.00, provider: 'google' },
  'gemini-3-pro':       { context: 2000000, input:  2.00, output: 12.00, provider: 'google' },
  'gemini-3-flash':     { context: 1000000, input:  0.50, output:  3.00, provider: 'google' },
  'gemini-3.1-flash-lite': { context: 1000000, input: 0.25, output:  1.50, provider: 'google' },
  'gemini-2.5-pro':     { context: 2000000, input:  1.25, output: 10.00, provider: 'google' },
  'gemini-2.5-flash':   { context: 1000000, input:  0.30, output:  2.50, provider: 'google' },

  // Meta
  'llama-4-scout':      { context:10000000, input:  0.15, output:  0.60, provider: 'meta' },
  'llama-4-maverick':   { context: 1000000, input:  0.15, output:  0.60, provider: 'meta' },
  'llama-3.3-70b':      { context:  128000, input:  0.40, output:  0.40, provider: 'meta' },

  // Mistral
  'mistral-large-3':    { context:  128000, input:  2.00, output:  6.00, provider: 'mistral' },
  'mistral-medium-3':   { context:  128000, input:  1.00, output:  3.00, provider: 'mistral' },
  'mistral-small-4':    { context:  128000, input:  0.15, output:  0.60, provider: 'mistral' },
  'magistral-medium':   { context:   40000, input:  2.00, output:  5.00, provider: 'mistral' },

  // xAI
  'grok-4':             { context:  256000, input:  3.00, output: 15.00, provider: 'xai' },
  'grok-4.1-fast':      { context: 2000000, input:  0.20, output:  0.50, provider: 'xai' },

  // DeepSeek
  'deepseek-v3.2':      { context:  128000, input:  0.28, output:  0.42, provider: 'deepseek' },
  'deepseek-r2':        { context:  128000, input:  0.70, output:  2.50, provider: 'deepseek' },

  // Cohere
  'command-a':          { context:  256000, input:  2.50, output: 10.00, provider: 'cohere' },
  'command-r-plus':     { context:  128000, input:  2.50, output: 10.00, provider: 'cohere' },
  'command-r':          { context:  128000, input:  0.15, output:  0.60, provider: 'cohere' },
  'command-r7b':        { context:  128000, input:  0.0375,output: 0.15, provider: 'cohere' },

  // Alibaba
  'qwen3-max':          { context:  262000, input:  0.78, output:  3.90, provider: 'alibaba' },
};

const ALIASES = {
  gpt:         'gpt-5.4',
  openai:      'gpt-5.4',
  claude:      'claude-sonnet-4-6',
  opus:        'claude-opus-4-7',
  sonnet:      'claude-sonnet-4-6',
  haiku:       'claude-haiku-4-5',
  anthropic:   'claude-sonnet-4-6',
  gemini:      'gemini-3-flash',
  'gemini-pro':'gemini-3.1-pro',
  google:      'gemini-3-flash',
  llama:       'llama-4-maverick',
  mistral:     'mistral-large-3',
  grok:        'grok-4',
  deepseek:    'deepseek-v3.2',
  qwen:        'qwen3-max',
  cohere:      'command-a',
  command:     'command-a',
  reasoning:   'o3',
};

function resolveModel(name) {
  if (!name) return 'claude-sonnet-4-6';
  const k = String(name).toLowerCase();
  if (MODELS[k]) return k;
  if (ALIASES[k]) return ALIASES[k];
  return 'claude-sonnet-4-6';
}

// Approximate token count from character count. Good enough for "this
// prompt got +X tokens longer" delta math at the diff level.
function approxTokens(text) {
  if (!text) return 0;
  // Blend char/4 with word*1.3 — same approximation family used in
  // @v0idd0/tokcount. See that package for a more rigorous version.
  const words = (text.match(/\b\w+\b/g) || []).length;
  const puncts = (text.match(/[^\w\s]/g) || []).length;
  const chars = text.length;
  return Math.ceil(((words * 1.3) + puncts + (chars / 3.8)) / 2);
}

function costForTokens(inputTokens, outputTokens, model) {
  const key = resolveModel(model);
  const m = MODELS[key];
  const inputCost = (inputTokens / 1_000_000) * m.input;
  const outputCost = (outputTokens / 1_000_000) * m.output;
  return { input: inputCost, output: outputCost, total: inputCost + outputCost, model: key };
}

module.exports = { MODELS, ALIASES, resolveModel, approxTokens, costForTokens };
