// promptdiff — compare prompt versions.
// https://voiddo.com/tools/promptdiff/

const { approxTokens, costForTokens, resolveModel } = require('./pricing');

function tokenize(text) {
  // Split into words while preserving whitespace info
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function chars(text) {
  return [...text];
}

function lcs(arr1, arr2) {
  // Longest common subsequence. O(m*n) time/space — fine for prompts
  // up to tens of thousands of tokens. For huge inputs we'd want Myers
  // but prompts are virtually always small.
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      result.unshift({ value: arr1[i - 1], index1: i - 1, index2: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// Generic LCS-based diff at the granularity of `unitsFn(text)` (words or chars).
function genericDiff(text1, text2, unitsFn) {
  const u1 = unitsFn(text1);
  const u2 = unitsFn(text2);
  const common = lcs(u1, u2);

  const result = [];
  let idx1 = 0;
  let idx2 = 0;

  const isWhitespace = (s) => /^\s+$/.test(s);

  for (const c of common) {
    while (idx1 < c.index1) {
      result.push(isWhitespace(u1[idx1])
        ? { type: 'same', value: u1[idx1] }
        : { type: 'removed', value: u1[idx1] });
      idx1++;
    }
    while (idx2 < c.index2) {
      if (!isWhitespace(u2[idx2])) {
        result.push({ type: 'added', value: u2[idx2] });
      }
      idx2++;
    }
    result.push({ type: 'same', value: c.value });
    idx1++;
    idx2++;
  }

  while (idx1 < u1.length) {
    result.push(isWhitespace(u1[idx1])
      ? { type: 'same', value: u1[idx1] }
      : { type: 'removed', value: u1[idx1] });
    idx1++;
  }
  while (idx2 < u2.length) {
    result.push(isWhitespace(u2[idx2])
      ? { type: 'same', value: u2[idx2] }
      : { type: 'added', value: u2[idx2] });
    idx2++;
  }

  return result;
}

function diff(text1, text2) {
  return genericDiff(text1, text2, tokenize);
}

function charDiff(text1, text2) {
  return genericDiff(text1, text2, chars);
}

function lineDiff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const common = lcs(lines1, lines2);

  const result = [];
  let idx1 = 0;
  let idx2 = 0;

  for (const c of common) {
    while (idx1 < c.index1) {
      result.push({ type: 'removed', value: lines1[idx1], line: idx1 + 1 });
      idx1++;
    }
    while (idx2 < c.index2) {
      result.push({ type: 'added', value: lines2[idx2], line: idx2 + 1 });
      idx2++;
    }
    result.push({ type: 'same', value: c.value, line1: idx1 + 1, line2: idx2 + 1 });
    idx1++;
    idx2++;
  }

  while (idx1 < lines1.length) {
    result.push({ type: 'removed', value: lines1[idx1], line: idx1 + 1 });
    idx1++;
  }
  while (idx2 < lines2.length) {
    result.push({ type: 'added', value: lines2[idx2], line: idx2 + 1 });
    idx2++;
  }

  return result;
}

function stats(text1, text2, diffResult) {
  const words1 = text1.split(/\s+/).filter((w) => w.length > 0).length;
  const words2 = text2.split(/\s+/).filter((w) => w.length > 0).length;
  const chars1 = text1.length;
  const chars2 = text2.length;

  const added = diffResult.filter((d) => d.type === 'added').length;
  const removed = diffResult.filter((d) => d.type === 'removed').length;
  const same = diffResult.filter((d) => d.type === 'same' && !/^\s+$/.test(d.value)).length;

  const similarity = same / Math.max(same + added + removed, 1);
  const tokens1 = approxTokens(text1);
  const tokens2 = approxTokens(text2);

  return {
    before: { words: words1, chars: chars1, tokens: tokens1 },
    after: { words: words2, chars: chars2, tokens: tokens2 },
    delta: { words: words2 - words1, chars: chars2 - chars1, tokens: tokens2 - tokens1 },
    changes: { added, removed, unchanged: same },
    similarity: Math.round(similarity * 100),
  };
}

// Word-frequency delta: which words gained/lost occurrences between versions.
function wordFrequencyDelta(text1, text2, options = {}) {
  const { minLen = 3, top = 15, caseSensitive = false } = options;
  const norm = (s) => (caseSensitive ? s : s.toLowerCase());

  function countWords(text) {
    const counts = new Map();
    const words = text.match(/\b\w+\b/g) || [];
    for (const w of words) {
      if (w.length < minLen) continue;
      const k = norm(w);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return counts;
  }

  const a = countWords(text1);
  const b = countWords(text2);
  const all = new Set([...a.keys(), ...b.keys()]);

  const deltas = [];
  for (const w of all) {
    const before = a.get(w) || 0;
    const after = b.get(w) || 0;
    if (before === after) continue;
    deltas.push({ word: w, before, after, delta: after - before });
  }

  deltas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return deltas.slice(0, top);
}

function tokenImpact(text1, text2, model = 'claude-sonnet-4-6', callsPerMonth = 100) {
  const t1 = approxTokens(text1);
  const t2 = approxTokens(text2);
  const delta = t2 - t1;

  const before = costForTokens(t1, 0, model);
  const after = costForTokens(t2, 0, model);
  const perCall = after.total - before.total;

  return {
    model: resolveModel(model),
    tokens: { before: t1, after: t2, delta },
    costPerCall: { before: before.total, after: after.total, delta: perCall },
    monthly: { calls: callsPerMonth, deltaCost: perCall * callsPerMonth },
  };
}

function formatInline(diffResult, colors = true) {
  let output = '';
  for (const d of diffResult) {
    if (d.type === 'added') {
      output += colors ? `\x1b[32m[+${d.value}]\x1b[0m` : `[+${d.value}]`;
    } else if (d.type === 'removed') {
      output += colors ? `\x1b[31m[-${d.value}]\x1b[0m` : `[-${d.value}]`;
    } else {
      output += d.value;
    }
  }
  return output;
}

function formatSideBySide(text1, text2, width = 40) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const maxLines = Math.max(lines1.length, lines2.length);

  const output = [];
  output.push('┌' + '─'.repeat(width + 2) + '┬' + '─'.repeat(width + 2) + '┐');
  output.push('│ ' + 'BEFORE'.padEnd(width) + ' │ ' + 'AFTER'.padEnd(width) + ' │');
  output.push('├' + '─'.repeat(width + 2) + '┼' + '─'.repeat(width + 2) + '┤');

  for (let i = 0; i < maxLines; i++) {
    const left = (lines1[i] || '').slice(0, width).padEnd(width);
    const right = (lines2[i] || '').slice(0, width).padEnd(width);
    output.push(`│ ${left} │ ${right} │`);
  }

  output.push('└' + '─'.repeat(width + 2) + '┴' + '─'.repeat(width + 2) + '┘');

  return output.join('\n');
}

function formatUnified(lineDiffResult, colors = true) {
  const output = [];
  for (const d of lineDiffResult) {
    if (d.type === 'added') {
      const line = `+ ${d.value}`;
      output.push(colors ? `\x1b[32m${line}\x1b[0m` : line);
    } else if (d.type === 'removed') {
      const line = `- ${d.value}`;
      output.push(colors ? `\x1b[31m${line}\x1b[0m` : line);
    } else {
      output.push(`  ${d.value}`);
    }
  }
  return output.join('\n');
}

// Markdown-flavored unified diff, suitable for PR comments.
function formatMarkdown(lineDiffResult, meta = {}) {
  const { file1 = 'before', file2 = 'after' } = meta;
  const out = [];
  out.push('```diff');
  out.push(`--- ${file1}`);
  out.push(`+++ ${file2}`);
  for (const d of lineDiffResult) {
    if (d.type === 'added')   out.push(`+ ${d.value}`);
    else if (d.type === 'removed') out.push(`- ${d.value}`);
    else                      out.push(`  ${d.value}`);
  }
  out.push('```');
  return out.join('\n');
}

module.exports = {
  diff,
  charDiff,
  lineDiff,
  stats,
  wordFrequencyDelta,
  tokenImpact,
  formatInline,
  formatSideBySide,
  formatUnified,
  formatMarkdown,
  tokenize,
};
