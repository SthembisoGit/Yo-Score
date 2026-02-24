const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, 'challenge-pack.v2.json');
const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'csharp'];
const POINTS = [1, 1, 2, 2, 3, 3];

const norm = (v) => String(v ?? '').replace(/\r\n/g, '\n');
const splitLines = (v) => norm(v).trimEnd().split('\n');
const ints = (v) => norm(v).trim().split(/\s+/).filter(Boolean).map(Number);

const solve = {
  normalize_tokens(input) {
    const seen = new Set();
    const out = [];
    for (const token of norm(input).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)) {
      if (!seen.has(token)) {
        seen.add(token);
        out.push(token);
      }
    }
    return out.length ? out.join('|') : 'empty';
  },
  dedupe_emails(input) {
    const rows = splitLines(input);
    const n = Number(rows[0] ?? 0);
    const set = new Set();
    for (let i = 1; i <= n; i += 1) {
      const email = String(rows[i] ?? '').trim().toLowerCase();
      if (email) set.add(email);
    }
    return String(set.size);
  },
  sql_guard(input) {
    const value = norm(input).toLowerCase();
    return ['--', ';--', 'or 1=1', 'union select'].some((m) => value.includes(m)) ? 'BLOCK' : 'ALLOW';
  },
  path_safety(input) {
    const value = norm(input).toLowerCase();
    return ['../', '..\\', '%2e%2e'].some((m) => value.includes(m)) ? 'BLOCK' : 'SAFE';
  },
  off_by_one_range(input) {
    const [aRaw, bRaw, kRaw] = ints(input);
    if (!Number.isFinite(aRaw) || !Number.isFinite(bRaw) || !Number.isFinite(kRaw) || kRaw === 0) return '0';
    const a = Math.min(aRaw, bRaw);
    const b = Math.max(aRaw, bRaw);
    const k = Math.abs(kRaw);
    const count = Math.floor(b / k) - Math.floor((a - 1) / k);
    return String(Math.max(0, count));
  },
  compress_repeats(input) {
    const tokens = norm(input).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return '';
    const out = [tokens[0]];
    for (let i = 1; i < tokens.length; i += 1) {
      if (tokens[i].toLowerCase() !== tokens[i - 1].toLowerCase()) out.push(tokens[i]);
    }
    return out.join(' ');
  },
  log_counts(input) {
    const rows = splitLines(input);
    const n = Number(rows[0] ?? 0);
    let info = 0;
    let warn = 0;
    let error = 0;
    for (let i = 1; i <= n; i += 1) {
      const row = String(rows[i] ?? '').toLowerCase();
      if (row.includes('info')) info += 1;
      if (row.includes('warn')) warn += 1;
      if (row.includes('error')) error += 1;
    }
    return `INFO:${info},WARN:${warn},ERROR:${error}`;
  },
  retry_backoff(input) {
    const [base, retries] = ints(input);
    if (!Number.isFinite(base) || !Number.isFinite(retries) || retries <= 0) return '';
    return Array.from({ length: retries }, (_, i) => String(base * 2 ** i)).join(',');
  },
  status_histogram(input) {
    const rows = splitLines(input);
    const n = Number(rows[0] ?? 0);
    const counts = new Map();
    for (let i = 1; i <= n; i += 1) {
      const key = String(rows[i] ?? '').trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(',');
  },
  window_max_sum(input) {
    const values = ints(input);
    const n = values[0];
    const k = values[1];
    const arr = values.slice(2, 2 + n);
    if (!Number.isFinite(n) || !Number.isFinite(k) || k <= 0 || arr.length < k) return '0';
    let sum = 0;
    for (let i = 0; i < k; i += 1) sum += arr[i];
    let best = sum;
    for (let i = k; i < arr.length; i += 1) {
      sum += arr[i] - arr[i - k];
      if (sum > best) best = sum;
    }
    return String(best);
  },
  balanced_brackets(input) {
    const text = norm(input).trim();
    const stack = [];
    const pair = { ')': '(', ']': '[', '}': '{' };
    for (const ch of text) {
      if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
      if (pair[ch]) {
        const top = stack.pop();
        if (top !== pair[ch]) return 'INVALID';
      }
    }
    return stack.length === 0 ? 'VALID' : 'INVALID';
  },
  max_of_three(input) {
    const [a, b, c] = ints(input);
    return String(Math.max(a, b, c));
  },
  range_sum(input) {
    const [n] = ints(input);
    return !Number.isFinite(n) || n <= 0 ? '0' : String((n * (n + 1)) / 2);
  },
  reverse_line(input) {
    return norm(input).replace(/\n$/, '').split('').reverse().join('');
  },
  frequency_letters(input) {
    const counts = new Map();
    for (const ch of norm(input).toLowerCase()) {
      if (ch >= 'a' && ch <= 'z') counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}:${v}`).join(',');
  },
  password_policy(input) {
    const v = norm(input).trim();
    const strong = v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
    return strong ? 'STRONG' : 'WEAK';
  },
  ipv4_validate(input) {
    const p = norm(input).trim().split('.');
    if (p.length !== 4) return 'INVALID';
    for (const part of p) {
      if (!/^\d+$/.test(part)) return 'INVALID';
      const n = Number(part);
      if (n < 0 || n > 255) return 'INVALID';
    }
    return 'VALID';
  },
  null_safe_average(input) {
    const rows = splitLines(input);
    const n = Number(rows[0] ?? 0);
    const tokens = (rows[1] ?? '').trim().split(/\s+/).slice(0, n);
    const values = tokens.filter((t) => !['null', 'nan'].includes(t.toLowerCase())).map(Number).filter(Number.isFinite);
    if (!values.length) return '0';
    return String(Math.floor(values.reduce((a, b) => a + b, 0) / values.length));
  },
  csv_quantity_sum(input) {
    const rows = splitLines(input);
    const n = Number(rows[0] ?? 0);
    let total = 0;
    for (let i = 1; i <= n; i += 1) {
      const cols = String(rows[i] ?? '').split(',');
      if (cols.length < 3) continue;
      const qty = Number(cols[1].trim());
      if (Number.isFinite(qty)) total += qty;
    }
    return String(total);
  },
};

const archetypes = {
  normalize_tokens: { prompt: 'Normalize comma-separated tokens (trim/lowercase/dedupe).', constraints: 'O(n) with set.', cases: [' API, auth ,API, Cache ,, cache,Queue\n', 'a,b,c\n', ' , , \n', 'One, two, THREE, two\n', 'x\n', 'A,a,A,a\n'] },
  dedupe_emails: { prompt: 'Count unique emails after trim+lowercase normalization.', constraints: 'O(n) set-based.', cases: ['5\na@x.com\nA@x.com\n b@y.com\nB@y.com \nc@z.com\n', '3\nuser@a.com\nuser@a.com\nuser@a.com\n', '4\none@a.com\ntwo@a.com\nthree@a.com\nfour@a.com\n', '2\n test@x.com\nTEST@X.COM\n', '1\nsolo@x.com\n', '6\na@a.com\nb@a.com\nA@A.com\nB@A.com\nc@a.com\nC@A.com\n'] },
  sql_guard: { prompt: 'Detect common SQL injection markers and print BLOCK/ALLOW.', constraints: 'Case-insensitive marker checks.', cases: ["name='john' OR 1=1\n", 'SELECT * FROM users WHERE id=4\n', 'UNION SELECT password FROM users\n', 'status=active -- comment\n', 'email = \"abc@x.com\"\n', 'id=1;--\n'] },
  path_safety: { prompt: 'Block traversal tokens (../, ..\\, %2e%2e).', constraints: 'Case-insensitive encoded checks.', cases: ['images/profile.png\n', '../etc/passwd\n', '..\\windows\\system32\n', '/public/%2E%2E/secrets\n', 'assets/icons/menu.svg\n', './safe/path\n'] },
  off_by_one_range: { prompt: 'Count numbers divisible by k in inclusive [a,b].', constraints: 'O(1) arithmetic.', cases: ['1 10 2\n', '5 5 5\n', '6 14 7\n', '2 3 5\n', '-10 10 5\n', '100 130 10\n'] },
  compress_repeats: { prompt: 'Collapse consecutive duplicate tokens (case-insensitive).', constraints: 'O(n), preserve first casing in run.', cases: ['a a a b b c\n', 'Login login LOGIN success\n', 'x\n', 'up up down down down up\n', 'A a B b B\n', 'one two two three three three\n'] },
  log_counts: { prompt: 'Count INFO/WARN/ERROR lines from log input.', constraints: 'Case-insensitive line checks.', cases: ['4\nINFO ok\nWARN disk\nERROR fail\nINFO done\n', '2\nDEBUG hi\nTRACE no\n', '3\nERROR a\nERROR b\nWARN c\n', '5\ninfo a\nwarn b\nwarn c\nerror d\nINFO e\n', '1\nWARN only\n', '3\nerror\nwarn\ninfo\n'] },
  retry_backoff: { prompt: 'Generate exponential backoff sequence.', constraints: 'O(r).', cases: ['100 4\n', '50 1\n', '10 3\n', '1 5\n', '7 2\n', '3 6\n'] },
  status_histogram: { prompt: 'Print alphabetical status histogram key:count.', constraints: 'Normalize lowercase first.', cases: ['5\nopen\nclosed\nopen\npending\nclosed\n', '3\nOK\nok\nOk\n', '1\nqueued\n', '4\na\nb\nc\nd\n', '4\nwarn\nwarn\nwarn\nwarn\n', '2\nup\ndown\n'] },
  window_max_sum: { prompt: 'Compute max contiguous sum with fixed window k.', constraints: 'O(n) sliding window.', cases: ['5 2\n1 2 3 4 5\n', '6 3\n-1 -2 -3 -4 -5 -6\n', '4 4\n2 2 2 2\n', '8 3\n1 3 -1 -3 5 3 6 7\n', '5 1\n9 8 7 6 5\n', '7 2\n5 -1 2 3 -2 4 1\n'] },
  balanced_brackets: { prompt: 'Validate bracket sequence and print VALID/INVALID.', constraints: 'O(n) stack.', cases: ['([]){}\n', '([)]\n', '((()))\n', '((()\n', '{[()]}[]\n', '}{\n'] },
  max_of_three: { prompt: 'Print max of three integers.', constraints: 'O(1).', cases: ['1 5 3\n', '-1 -5 -3\n', '10 10 7\n', '0 0 0\n', '99 4 98\n', '-9 8 -10\n'] },
  range_sum: { prompt: 'Compute sum from 1..n (or 0 when n<=0).', constraints: 'Use O(1) formula.', cases: ['1\n', '5\n', '10\n', '0\n', '100\n', '1000\n'] },
  reverse_line: { prompt: 'Reverse the input line.', constraints: 'O(n).', cases: ['hello\n', 'Yo Score\n', 'abc123\n', 'racecar\n', 'a b c\n', '!@#\n'] },
  frequency_letters: { prompt: 'Frequency map for letters sorted alphabetically.', constraints: 'Ignore spaces/case/non-letters.', cases: ['aA b\n', 'YoScore\n', 'bbb aaa\n', '123 !\n', 'Z z Z\n', 'AbCabc\n'] },
  password_policy: { prompt: 'Validate password policy and print STRONG/WEAK.', constraints: 'Single-pass checks.', cases: ['YoScore@2026\n', 'password\n', 'A1@aaaa\n', 'Abcdef1!\n', 'ABCDEF12!\n', 'abc123!@#\n'] },
  ipv4_validate: { prompt: 'Validate IPv4 address.', constraints: 'Four octets in 0..255.', cases: ['192.168.0.1\n', '256.1.1.1\n', '10.0.0\n', '01.2.3.4\n', 'a.b.c.d\n', '0.0.0.0\n'] },
  null_safe_average: { prompt: 'Ignore null/NaN tokens and compute floor average.', constraints: 'Print 0 when no numeric token.', cases: ['5\n1 2 null 3 NaN\n', '4\nnull NaN null NaN\n', '3\n10 20 30\n', '6\n5 -5 5 -5 null 0\n', '1\n7\n', '5\n1 2 3 4 5\n'] },
  csv_quantity_sum: { prompt: 'Sum qty column from CSV rows item,qty,price.', constraints: 'Skip malformed rows.', cases: ['3\npen,2,10\npaper, 5 ,3\nclip,1,1\n', '2\na,10,0\nb,20,0\n', '3\nx,1,1\ninvalid\ny,2,2\n', '1\nitem,  7, 50\n', '4\na,0,1\nb,0,2\nc,0,3\nd,0,4\n', '2\n p,3,9\n q,4,1\n'] },
};

const categoryEntries = {
  Frontend: [['Frontend: Debounced Search Event Cleaner (AI Fix)', 'compress_repeats', true, 'state mutation side effects'], ['Frontend: Query Tag Normalizer (AI Fix)', 'normalize_tokens', true, 'input parsing faults'], ['Frontend: Inclusive Page Range Counter (AI Fix)', 'off_by_one_range', true, 'off-by-one logic bugs'], ['Frontend: Label Frequency Sanitizer (AI Fix)', 'frequency_letters', true, 'input parsing faults'], ['Frontend: Feature Flag Histogram', 'status_histogram', false, null], ['Frontend: Banner Rotation Window Max', 'window_max_sum', false, null]],
  Backend: [['Backend: Email Dedupe Pipeline (AI Fix)', 'dedupe_emails', true, 'input normalization bugs'], ['Backend: SQL Marker Guard (AI Fix)', 'sql_guard', true, 'unsafe validation/security issues'], ['Backend: CSV Quantity Aggregator (AI Fix)', 'csv_quantity_sum', true, 'messy delimiter parsing'], ['Backend: Path Traversal Blocker (AI Fix)', 'path_safety', true, 'unsafe validation/security issues'], ['Backend: Retry Backoff Planner', 'retry_backoff', false, null], ['Backend: API Log Severity Counter', 'log_counts', false, null]],
  Security: [['Security: Injection Signature Screen (AI Fix)', 'sql_guard', true, 'unsafe validation/security issues'], ['Security: Path Canonicalization Sentinel (AI Fix)', 'path_safety', true, 'unsafe validation/security issues'], ['Security: Password Policy Validator (AI Fix)', 'password_policy', true, 'messy policy checks'], ['Security: IPv4 Allowlist Validator (AI Fix)', 'ipv4_validate', true, 'input parsing faults'], ['Security: Bracketed Policy Parser', 'balanced_brackets', false, null], ['Security: Failed-Event Window Detector', 'window_max_sum', false, null]],
  DevOps: [['DevOps: Deployment Status Compactor (AI Fix)', 'compress_repeats', true, 'state mutation side effects'], ['DevOps: Service Tag Normalizer (AI Fix)', 'normalize_tokens', true, 'input parsing faults'], ['DevOps: Inclusive Build Range Counter (AI Fix)', 'off_by_one_range', true, 'off-by-one logic bugs'], ['DevOps: Pipeline Log Counter (AI Fix)', 'log_counts', true, 'messy code parsing'], ['DevOps: Rollback Retry Backoff', 'retry_backoff', false, null], ['DevOps: Incident Histogram', 'status_histogram', false, null]],
  'Cloud Engineering': [['Cloud Engineering: Bucket Path Guard (AI Fix)', 'path_safety', true, 'unsafe validation/security issues'], ['Cloud Engineering: Config Token Normalizer (AI Fix)', 'normalize_tokens', true, 'input parsing faults'], ['Cloud Engineering: Request Window Counter (AI Fix)', 'off_by_one_range', true, 'off-by-one logic bugs'], ['Cloud Engineering: Node Event Deduper (AI Fix)', 'compress_repeats', true, 'state mutation side effects'], ['Cloud Engineering: Auto-Scale Retry Plan', 'retry_backoff', false, null], ['Cloud Engineering: Alert Severity Summary', 'log_counts', false, null]],
  'Data Science': [['Data Science: Null-Safe Sample Average (AI Fix)', 'null_safe_average', true, 'null handling bugs'], ['Data Science: Label Frequency Cleanup (AI Fix)', 'frequency_letters', true, 'messy preprocessing logic'], ['Data Science: CSV Quantity Parser (AI Fix)', 'csv_quantity_sum', true, 'input parsing faults'], ['Data Science: Sliding Window Peak', 'window_max_sum', false, null], ['Data Science: Dataset Status Histogram', 'status_histogram', false, null]],
  'Mobile Development': [['Mobile Development: Gesture Event Deduper (AI Fix)', 'compress_repeats', true, 'state mutation side effects'], ['Mobile Development: Route Token Normalizer (AI Fix)', 'normalize_tokens', true, 'input parsing faults'], ['Mobile Development: Daily Step Range Sum', 'range_sum', false, null], ['Mobile Development: Foreground Status Histogram', 'status_histogram', false, null], ['Mobile Development: Input Reverse Preview', 'reverse_line', false, null]],
  'QA Testing': [['QA Testing: Test Case Label Cleaner (AI Fix)', 'normalize_tokens', true, 'messy parsing code'], ['QA Testing: Fault Log Severity Counter (AI Fix)', 'log_counts', true, 'input parsing faults'], ['QA Testing: Boundary Range Verifier (AI Fix)', 'off_by_one_range', true, 'off-by-one logic bugs'], ['QA Testing: Defect Status Histogram', 'status_histogram', false, null], ['QA Testing: Bracket Sequence Validator', 'balanced_brackets', false, null]],
  'IT Support': [['IT Support: Ticket Tag Normalizer (AI Fix)', 'normalize_tokens', true, 'input parsing faults'], ['IT Support: Suspicious Path Blocker (AI Fix)', 'path_safety', true, 'unsafe validation/security issues'], ['IT Support: Helpdesk Priority Max of Three', 'max_of_three', false, null], ['IT Support: Escalation Retry Schedule', 'retry_backoff', false, null], ['IT Support: Shift Log Counter', 'log_counts', false, null]],
};

const shuffle = (arr, seed) => {
  const copy = [...arr];
  let x = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    x = (1664525 * x + 1013904223) >>> 0;
    const j = Math.floor((x / 0xffffffff) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const seniority = shuffle([...Array(12).fill('graduate'), ...Array(13).fill('junior'), ...Array(13).fill('mid'), ...Array(12).fill('senior')], 20260224);
const difficulty = shuffle([...Array(18).fill('easy'), ...Array(22).fill('medium'), ...Array(10).fill('hard')], 20260301);

const entries = [];
for (const [category, list] of Object.entries(categoryEntries)) {
  for (const [title, archetypeKey, aiFix, mistakeClass] of list) entries.push({ category, title, archetypeKey, aiFix, mistakeClass });
}

if (entries.length !== 50) throw new Error(`Expected 50 entries, got ${entries.length}`);

const challenges = entries.map((entry, i) => {
  const archetype = archetypes[entry.archetypeKey];
  const run = solve[entry.archetypeKey];
  const level = difficulty[i];
  const duration = Math.max(20, Math.min(75, (level === 'easy' ? 30 : level === 'medium' ? 40 : 55) + (entry.aiFix ? 5 : 0)));
  return {
    title: entry.title,
    category: entry.category,
    difficulty: level,
    seniority: seniority[i],
    duration,
    ai_fix: entry.aiFix,
    mistake_class: entry.mistakeClass,
    description: [
      entry.aiFix
        ? `AI-generated code attempt contains common mistake class: ${entry.mistakeClass}. Fix the logic and produce correct output.`
        : 'Solve the task using clean, deterministic logic and stable output formatting.',
      archetype.prompt,
      `Constraints: ${archetype.constraints}`,
      'Expected runtime envelope: accepted solutions should generally run below 2.5 seconds on baseline limits.',
    ].join('\n'),
    tests: archetype.cases.map((input, idx) => ({
      name: `case-${idx + 1}`,
      input,
      output: String(run(input)),
      points: POINTS[idx] ?? 1,
      is_hidden: true,
      timeout_ms: level === 'hard' ? 6000 : 5000,
      memory_mb: 256,
    })),
    supported_languages: LANGUAGES,
    baseline: {
      runtime_ms: level === 'easy' ? 2200 : level === 'medium' ? 2600 : 3200,
      memory_mb: 256,
      lint_rules: {},
    },
  };
});

const summary = challenges.reduce(
  (acc, c) => {
    acc.total += 1;
    acc.aiFix += c.ai_fix ? 1 : 0;
    acc.categories[c.category] = (acc.categories[c.category] ?? 0) + 1;
    acc.seniority[c.seniority] = (acc.seniority[c.seniority] ?? 0) + 1;
    acc.difficulty[c.difficulty] = (acc.difficulty[c.difficulty] ?? 0) + 1;
    return acc;
  },
  { total: 0, aiFix: 0, categories: {}, seniority: {}, difficulty: {} },
);

fs.writeFileSync(
  OUTPUT,
  `${JSON.stringify({ version: 'v2', generated_at: new Date().toISOString(), summary, challenges }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify(summary, null, 2));
