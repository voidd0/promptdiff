# promptdiff

> **Compare LLM prompt versions. See what broke your AI. Free forever.**
> A gift to the terminal from [**vøiddo**](https://voiddo.com).

[![npm](https://img.shields.io/npm/v/@v0idd0/promptdiff?color=%2322c55e&label=%40v0idd0%2Fpromptdiff)](https://www.npmjs.com/package/@v0idd0/promptdiff)
[![downloads](https://img.shields.io/npm/dm/@v0idd0/promptdiff?color=%2322c55e)](https://www.npmjs.com/package/@v0idd0/promptdiff)
[![license](https://img.shields.io/npm/l/@v0idd0/promptdiff?color=%2322c55e)](./LICENSE)
[![node](https://img.shields.io/node/v/@v0idd0/promptdiff?color=%2322c55e)](./package.json)

**[Homepage](https://voiddo.com/tools/promptdiff/)** · **[GitHub](https://github.com/voidd0/promptdiff)** · **[npm](https://www.npmjs.com/package/@v0idd0/promptdiff)** · **[All tools](https://voiddo.com/tools/)** · **[Contact](mailto:support@voiddo.com)**

---

## Why promptdiff

You changed a system prompt last Tuesday. Since then, something is subtly wrong — the tone shifted, the outputs grew longer, the cost went up, or the model started hallucinating examples you thought you had removed. You open `git diff` and get a wall of color-agnostic text because prompts live in markdown and `diff(1)` has no opinion about them.

**promptdiff does the LLM-specific job the generic diff cannot:**

- Word- and character-level diff (not just line-level).
- **Word-frequency delta** — so you see that the word `concise` quietly got deleted while three `please` were added.
- **Token-impact** — "this change adds 247 tokens on claude-opus-4-7 — costs you +$0.006 per call, +$0.60/mo at 100 calls."
- **Multi-version timeline** — pass three, four, eight prompt versions and see the evolution pair-by-pair.
- **Markdown-flavored output** for pasting directly into PR review comments.
- **JSON output** for CI pipelines that want to flag regressions.

Runs locally, no API keys, no telemetry, no upload. Free forever.

## Install

```bash
# npm
npm install -g @v0idd0/promptdiff

# or pnpm / yarn / bun
pnpm add -g @v0idd0/promptdiff
yarn global add @v0idd0/promptdiff
bun add -g @v0idd0/promptdiff

# one-shot via npx (no install)
npx @v0idd0/promptdiff v1.md v2.md --tokens --model claude
```

Requires Node.js **≥ 14**.

## Usage

```bash
# classic unified diff
promptdiff prompt-v1.md prompt-v2.md

# side-by-side
promptdiff v1.md v2.md --format side

# inline (great for short diffs)
promptdiff v1.md v2.md --format inline

# markdown — paste straight into a PR comment
promptdiff v1.md v2.md --format markdown -o pr.md

# stats only (word/char/token delta + similarity %)
promptdiff v1.md v2.md --stats

# token impact + cost on a specific model
promptdiff v1.md v2.md --tokens --model claude-opus-4-7 --calls 1000

# word-frequency delta (top 10 terms that gained/lost uses)
promptdiff v1.md v2.md --freq --freq-top 10

# multi-version evolution (3+ files → timeline of pair diffs)
promptdiff v1.md v2.md v3.md v4.md --stats

# compare text directly, no file needed
promptdiff -t "You are a helpful assistant" "You are a rogue assistant"

# character-level diff — useful for short prompts / single-token changes
promptdiff -t "cat" "bat" --char

# read second input from stdin
cat v2.md | promptdiff v1.md -

# JSON output for CI / jq
promptdiff v1.md v2.md --json --tokens --model gpt-5.4 | jq '.pairs[0].tokenImpact.monthly.deltaCost'

# replay a git history — diff against HEAD~1
promptdiff <(git show HEAD~1:prompt.md) prompt.md
```

## Token-impact math

Pricing is a 2026-04-22 snapshot verified against each provider's public pricing page. Cost is computed from an **approximate** tokenizer (blends char/word signals — close enough within ~5-10% of the vendor's own tokenizer for cost-planning purposes). Supported models include:

`gpt-5.4` · `gpt-5.4-mini` · `gpt-5.4-nano` · `gpt-4.1` · `gpt-4o` · `o3` · `o3-mini` · `o4-mini` · **`claude-opus-4-7`** (1M ctx) · `claude-opus-4-6` · `claude-sonnet-4-6` · `claude-haiku-4-5` · **`gemini-3.1-pro`** (2M ctx) · `gemini-3-flash` · `gemini-3.1-flash-lite` · **`llama-4-scout`** (10M ctx) · `llama-4-maverick` · `mistral-large-3` · `mistral-small-4` · `magistral-medium` · `grok-4` · **`grok-4.1-fast`** (2M ctx) · `deepseek-v3.2` · `deepseek-r2` · `qwen3-max` · `command-a` · `command-r7b` — full table in `src/pricing.js`.

**Short aliases** (pass to `--model`): `gpt`, `claude`, `opus`, `sonnet`, `haiku`, `gemini`, `gemini-pro`, `llama`, `mistral`, `grok`, `deepseek`, `qwen`, `command`, `reasoning` (=o3).

The same pricing table powers `@v0idd0/tokcount` and `@v0idd0/ctxstuff` — bumping any of the three gets you fresh numbers across all.

## Output formats

| `--format` | Best for |
|---|---|
| `unified` (default) | Terminal review, git-style |
| `inline` | Short prompts, small surgical changes |
| `side` | Comparing two prompts visually side-by-side |
| `markdown` | Pasting into a PR review comment |

All formats support `--no-color` for pipelines + log files.

## Library use

```js
const { diff, lineDiff, stats, wordFrequencyDelta, tokenImpact, formatMarkdown } =
  require('@v0idd0/promptdiff');

const a = fs.readFileSync('v1.md', 'utf8');
const b = fs.readFileSync('v2.md', 'utf8');

const s = stats(a, b, diff(a, b));
console.log(s.delta.tokens, 'token change', s.similarity, '% similar');

const impact = tokenImpact(a, b, 'claude-opus-4-7', /* calls/month */ 500);
console.log('+$' + impact.monthly.deltaCost.toFixed(2), 'per month');

const freq = wordFrequencyDelta(a, b, { minLen: 4, top: 10 });
console.log(freq);

const md = formatMarkdown(lineDiff(a, b), { file1: 'v1.md', file2: 'v2.md' });
console.log(md);  // paste into PR comment
```

## Why free forever

We are [**vøiddo**](https://voiddo.com) — a studio building small, sharp tools and a few serious products ([scrb](https://scrb.voiddo.com), [rankd](https://rankd.voiddo.com), [gridlock](https://gl.voiddo.com), and more). The serious products pay for themselves. The tools are gifts.

We write promptdiff because _we_ iterate on prompts daily, and we needed a fast, local, well-behaved tool for answering "what actually changed, and is it going to cost me more?"

## From the same studio

- **[@v0idd0/tokcount](https://www.npmjs.com/package/@v0idd0/tokcount)** — count LLM tokens + cost across 60+ models
- **[@v0idd0/ctxstuff](https://www.npmjs.com/package/@v0idd0/ctxstuff)** — pack codebases into LLM-ready context
- **[@v0idd0/jsonyo](https://www.npmjs.com/package/@v0idd0/jsonyo)** — JSON swiss army knife, 18 commands
- **[View all tools →](https://voiddo.com/tools/)**

## Contributing

Bug, feature idea, stale pricing, new provider? Open an issue at [github.com/voidd0/promptdiff/issues](https://github.com/voidd0/promptdiff/issues) or drop a line to [support@voiddo.com](mailto:support@voiddo.com).

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [vøiddo](https://voiddo.com/) — a small studio shipping AI-flavoured products, free dev tools, Chrome extensions and weird browser games.
