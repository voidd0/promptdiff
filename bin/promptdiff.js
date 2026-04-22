#!/usr/bin/env node

// promptdiff — see what broke your AI. Free forever from vøiddo.
// https://voiddo.com/tools/promptdiff/

const fs = require('fs');
const {
  diff, charDiff, lineDiff, stats,
  wordFrequencyDelta, tokenImpact,
  formatInline, formatSideBySide, formatUnified, formatMarkdown,
} = require('../src/differ');

const args = process.argv.slice(2);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function printHelp() {
  console.log(`
  ${BOLD}${MAGENTA}promptdiff${RESET} — compare prompt versions. See what broke your AI.
  ${DIM}Free forever from vøiddo.${RESET}

  ${DIM}Usage:${RESET}
    promptdiff <file1> <file2> [<file3> ...] [options]
    promptdiff -t "old prompt" "new prompt"
    cat new.md | promptdiff old.md -       (dash = stdin)

  ${DIM}Options:${RESET}
    -f, --format <fmt>    Output format: ${CYAN}unified${RESET} (default), inline, side, markdown
    -t, --text            Compare text strings directly (not files)
    -s, --stats           Stats only (word/char/token delta + similarity)
        --char            Character-level diff (for short prompts)
        --freq            Show word-frequency delta (what terms gained/lost)
        --freq-top <n>    How many frequency rows to print (default: 15)
        --freq-min <n>    Minimum word length to track (default: 3)
        --tokens          Show token-impact + cost estimate
    -m, --model <model>   Model for token-impact math (default: claude)
        --calls <n>       Monthly call volume for cost projection (default: 100)
        --json            Emit JSON (machine-readable)
        --no-color        Disable colored output
    -w, --width <n>       Side-by-side column width (default: 40)
    -o, --output <file>   Save diff to file
    -h, --help            Show this help
    -V, --version         Show version

  ${DIM}Formats:${RESET}
    unified    Line-by-line like git diff (default)
    inline     Changes mixed in with the prose as [+added] [-removed]
    side       Side-by-side columns
    markdown   Fenced \`\`\`diff block for PR comments

  ${DIM}Examples:${RESET}
    promptdiff v1.txt v2.txt
    promptdiff v1.txt v2.txt --format markdown -o pr-comment.md
    promptdiff prompt-old.md prompt-new.md --tokens --model claude-opus-4-7
    promptdiff short-a.txt short-b.txt --char
    promptdiff v1.md v2.md --freq --freq-top 10
    promptdiff v1.md v2.md v3.md v4.md --stats      ${DIM}# multi-version timeline${RESET}
    promptdiff -t "You are a helpful assistant" "You are a rogue assistant"
    promptdiff v1.txt v2.txt --json | jq '.delta.tokens'
    promptdiff <(git show HEAD~1:prompt.txt) prompt.txt

  ${DIM}Docs:   ${RESET} https://voiddo.com/tools/promptdiff/
  ${DIM}Issues: ${RESET} https://github.com/voidd0/promptdiff/issues
  ${DIM}Contact:${RESET} support@voiddo.com

  ${DIM}Built by vøiddo — we write tools so you do not have to. Enjoy.${RESET}
`);
}

function parseArgs() {
  const result = {
    files: [],
    texts: [],
    format: 'unified',
    textMode: false,
    statsOnly: false,
    freq: false,
    freqTop: 15,
    freqMin: 3,
    char: false,
    tokens: false,
    model: 'claude',
    calls: 100,
    json: false,
    color: true,
    width: 40,
    output: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') result.help = true;
    else if (arg === '-V' || arg === '--version') result.version = true;
    else if (arg === '-f' || arg === '--format') result.format = args[++i] || 'unified';
    else if (arg === '-t' || arg === '--text') result.textMode = true;
    else if (arg === '-s' || arg === '--stats') result.statsOnly = true;
    else if (arg === '--char') result.char = true;
    else if (arg === '--freq') result.freq = true;
    else if (arg === '--freq-top') result.freqTop = parseInt(args[++i]) || 15;
    else if (arg === '--freq-min') result.freqMin = parseInt(args[++i]) || 3;
    else if (arg === '--tokens') result.tokens = true;
    else if (arg === '-m' || arg === '--model') result.model = args[++i];
    else if (arg === '--calls') result.calls = parseInt(args[++i]) || 100;
    else if (arg === '--json') result.json = true;
    else if (arg === '--no-color') result.color = false;
    else if (arg === '-w' || arg === '--width') result.width = parseInt(args[++i]) || 40;
    else if (arg === '-o' || arg === '--output') result.output = args[++i];
    else if (!arg.startsWith('-') || arg === '-') {
      if (result.textMode) result.texts.push(arg);
      else result.files.push(arg);
    }
  }

  return result;
}

function readInput(ref) {
  if (ref === '-') {
    try { return fs.readFileSync(0, 'utf8'); }
    catch { return null; }
  }
  if (!fs.existsSync(ref)) {
    console.error(RED + `error: file not found: ${ref}` + RESET);
    process.exit(1);
  }
  return fs.readFileSync(ref, 'utf8');
}

function color(enabled, code, text) {
  return enabled ? code + text + RESET : String(text);
}

function printStats(s, opts) {
  const useColor = opts.color;
  console.log('');
  console.log(color(useColor, BOLD + MAGENTA, 'promptdiff') + color(useColor, DIM, '  — stats'));
  console.log(color(useColor, DIM, '─'.repeat(60)));
  console.log(`  Before:      ${s.before.words} words · ${s.before.chars} chars · ~${s.before.tokens} tokens`);
  console.log(`  After:       ${s.after.words} words · ${s.after.chars} chars · ~${s.after.tokens} tokens`);
  const d = s.delta;
  const sign = (n) => (n > 0 ? '+' : '');
  console.log(`  Delta:       ${color(useColor, d.words >= 0 ? GREEN : RED, sign(d.words) + d.words)} words · ${color(useColor, d.chars >= 0 ? GREEN : RED, sign(d.chars) + d.chars)} chars · ${color(useColor, d.tokens >= 0 ? GREEN : RED, sign(d.tokens) + d.tokens)} tokens`);
  console.log(`  Added:       ${color(useColor, GREEN, '+' + s.changes.added)}`);
  console.log(`  Removed:     ${color(useColor, RED, '-' + s.changes.removed)}`);
  console.log(`  Unchanged:   ${s.changes.unchanged}`);
  console.log(`  Similarity:  ${s.similarity}%`);
  console.log('');
}

function printFreq(rows, opts) {
  const useColor = opts.color;
  console.log('');
  console.log(color(useColor, BOLD + MAGENTA, 'promptdiff') + color(useColor, DIM, '  — word frequency delta'));
  console.log(color(useColor, DIM, '─'.repeat(60)));
  console.log(color(useColor, DIM, '  WORD'.padEnd(28) + 'BEFORE'.padStart(8) + '  AFTER'.padStart(8) + '   DELTA'));
  for (const r of rows) {
    const deltaStr = (r.delta > 0 ? '+' : '') + r.delta;
    const deltaColor = r.delta > 0 ? GREEN : RED;
    console.log('  ' +
      color(useColor, CYAN, r.word.padEnd(24)) +
      String(r.before).padStart(8) +
      String(r.after).padStart(8) +
      '   ' + color(useColor, deltaColor, deltaStr));
  }
  if (rows.length === 0) console.log('  ' + color(useColor, DIM, 'no differences'));
  console.log('');
}

function printTokenImpact(impact, opts) {
  const useColor = opts.color;
  const sign = (n) => (n > 0 ? '+' : '');
  const fmt = (usd) => {
    if (!usd || Math.abs(usd) < 0.000001) return '$0';
    if (Math.abs(usd) < 0.01) return '$' + usd.toFixed(6);
    if (Math.abs(usd) < 1) return '$' + usd.toFixed(4);
    return '$' + usd.toFixed(2);
  };
  const d = impact.tokens.delta;
  const deltaColor = d > 0 ? RED : GREEN;
  const costDeltaColor = impact.costPerCall.delta > 0 ? RED : GREEN;

  console.log('');
  console.log(color(useColor, BOLD + MAGENTA, 'promptdiff') +
    color(useColor, DIM, `  — token impact on ${impact.model}`));
  console.log(color(useColor, DIM, '─'.repeat(60)));
  console.log(`  Tokens before:   ${impact.tokens.before}`);
  console.log(`  Tokens after:    ${impact.tokens.after}`);
  console.log(`  Delta:           ${color(useColor, deltaColor, sign(d) + d + ' tokens')}`);
  console.log(`  Cost/call before: ${fmt(impact.costPerCall.before)}`);
  console.log(`  Cost/call after:  ${fmt(impact.costPerCall.after)}`);
  console.log(`  Delta per call:   ${color(useColor, costDeltaColor, sign(impact.costPerCall.delta) + fmt(impact.costPerCall.delta))}`);
  console.log(`  Monthly @ ${impact.monthly.calls} calls: ${color(useColor, costDeltaColor, sign(impact.monthly.deltaCost) + fmt(impact.monthly.deltaCost))}`);
  console.log('');
}

function pairwiseDiff(text1, text2, opts, meta = {}) {
  if (opts.char) {
    const d = charDiff(text1, text2);
    return formatInline(d, opts.color);
  }
  switch (opts.format) {
    case 'inline':
      return formatInline(diff(text1, text2), opts.color);
    case 'side':
      return formatSideBySide(text1, text2, opts.width);
    case 'markdown':
      return formatMarkdown(lineDiff(text1, text2), meta);
    case 'unified':
    default:
      return formatUnified(lineDiff(text1, text2), opts.color);
  }
}

function main() {
  const opts = parseArgs();

  if (opts.version) {
    const pkg = require('../package.json');
    console.log(`promptdiff v${pkg.version} — vøiddo, free forever. https://voiddo.com/tools/promptdiff/`);
    process.exit(0);
  }
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  let texts;
  let labels;

  if (opts.textMode) {
    if (opts.texts.length < 2) {
      console.error(RED + 'error: need at least two text strings to compare' + RESET);
      console.error('usage: promptdiff -t "text1" "text2"');
      process.exit(1);
    }
    texts = opts.texts;
    labels = opts.texts.map((_, i) => `v${i + 1}`);
  } else {
    if (opts.files.length < 2) {
      console.error(RED + 'error: need at least two files to compare' + RESET);
      console.error('usage: promptdiff file1.txt file2.txt [fileN...]');
      process.exit(1);
    }
    texts = opts.files.map(readInput);
    labels = opts.files;
  }

  // Multi-version mode — 3+ inputs = evolution timeline
  const isMulti = texts.length > 2;

  // JSON mode — single structured object for any input count
  if (opts.json) {
    const pairs = [];
    for (let i = 0; i < texts.length - 1; i++) {
      const a = texts[i];
      const b = texts[i + 1];
      const wordDiff = diff(a, b);
      const s = stats(a, b, wordDiff);
      const entry = {
        from: labels[i],
        to: labels[i + 1],
        stats: s,
      };
      if (opts.tokens) entry.tokenImpact = tokenImpact(a, b, opts.model, opts.calls);
      if (opts.freq) entry.frequency = wordFrequencyDelta(a, b, { minLen: opts.freqMin, top: opts.freqTop });
      pairs.push(entry);
    }
    const result = { multi: isMulti, count: texts.length, pairs };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Pretty output — iterate over consecutive pairs
  let combined = '';
  for (let i = 0; i < texts.length - 1; i++) {
    const a = texts[i];
    const b = texts[i + 1];
    const wordDiff = diff(a, b);
    const s = stats(a, b, wordDiff);

    if (isMulti || texts.length > 2) {
      const headerText = `${labels[i]} → ${labels[i + 1]}`;
      const header = opts.color
        ? `${BOLD}${MAGENTA}━━ ${headerText} ━━${RESET}\n`
        : `━━ ${headerText} ━━\n`;
      combined += header + '\n';
    }

    if (opts.statsOnly) {
      printStats(s, opts);
    } else {
      if (!opts.textMode && !isMulti && opts.format !== 'markdown') {
        const h = opts.color
          ? `${BOLD}--- ${labels[0]}\n+++ ${labels[1]}${RESET}\n`
          : `--- ${labels[0]}\n+++ ${labels[1]}\n`;
        combined += h + '\n';
      }
      const body = pairwiseDiff(a, b, opts, { file1: labels[i], file2: labels[i + 1] });
      combined += body;
      const footer = `\n${DIM}// ${s.similarity}% similar · ${s.changes.added >= 0 ? '+' : ''}${s.changes.added} -${s.changes.removed} · Δ${s.delta.tokens >= 0 ? '+' : ''}${s.delta.tokens} tokens${RESET}\n`;
      combined += opts.color ? footer : footer.replace(/\x1b\[[0-9;]*m/g, '');
    }

    if (opts.freq) {
      const rows = wordFrequencyDelta(a, b, { minLen: opts.freqMin, top: opts.freqTop });
      printFreq(rows, opts);
    }
    if (opts.tokens) {
      const impact = tokenImpact(a, b, opts.model, opts.calls);
      printTokenImpact(impact, opts);
    }
  }

  if (!opts.statsOnly && combined) {
    if (opts.output) {
      fs.writeFileSync(opts.output, combined.replace(/\x1b\[[0-9;]*m/g, ''));
      console.log(`${GREEN}✓${RESET} diff saved to ${opts.output}`);
    } else {
      console.log(combined);
    }
  }
}

main();
