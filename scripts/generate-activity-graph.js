#!/usr/bin/env node
/**
 * Generates dist/activity-signal-v2.svg: a contribution signal chart
 * using real GitHub contribution data (weekly totals for the last 12 months).
 *
 * Usage (GitHub Actions): GITHUB_TOKEN=... GITHUB_OWNER=user node scripts/generate-activity-graph.js
 * Offline local test:     node scripts/generate-activity-graph.js --mock
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join('dist', 'activity-signal-v2.svg');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

async function fetchWeeks(login, token) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'activity-signal' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);
  const json = await res.json();
  if (json.errors || !json.data || !json.data.user) throw new Error('GitHub query failed: ' + JSON.stringify(json.errors || json));
  return json.data.user.contributionsCollection.contributionCalendar;
}

function mockCalendar() {
  const weeks = [];
  const start = new Date(); start.setDate(start.getDate() - 7 * 52);
  let total = 0;
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      const c = Math.max(0, Math.round(Math.sin(w / 5) * 3 + (w > 30 ? 4 : 1) + ((w * 7 + d) % 5 === 0 ? 3 : 0)));
      total += c; days.push({ date: dt.toISOString().slice(0, 10), contributionCount: c });
    }
    weeks.push({ contributionDays: days });
  }
  return { totalContributions: total, weeks };
}

function build(cal) {
  const W = 600, H = 250;
  const L = 44, R = 572, T = 70, B = 196;
  const pts = cal.weeks.map(w => ({
    v: w.contributionDays.reduce((s, d) => s + d.contributionCount, 0),
    date: w.contributionDays[0] ? w.contributionDays[0].date : '',
  }));
  const max = Math.max(1, ...pts.map(p => p.v));
  const x = i => L + (i * (R - L)) / Math.max(1, pts.length - 1);
  const y = v => B - (v / max) * (B - T);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${R} ${B}L${L} ${B}Z`;
  const peaks = pts.map((p, i) => ({ ...p, i })).filter((p, k, a) => p.v > 0 && (k % 4 === 0 || p.v === max));

  // Show every other month label to fit on small screens.
  let lastMonth = -1, mi = 0; const labels = [];
  pts.forEach((p, i) => {
    if (!p.date) return;
    const m = Number(p.date.slice(5, 7)) - 1;
    if (m !== lastMonth) { lastMonth = m; if (mi++ % 2 === 0) labels.push(`<text x="${x(i).toFixed(1)}" y="${B + 18}" text-anchor="middle" class="k" style="font-size:10px">${MONTHS[m]}</text>`); }
  });
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${L}" y1="${(B - f * (B - T)).toFixed(1)}" x2="${R}" y2="${(B - f * (B - T)).toFixed(1)}" stroke="#0EA5E9" stroke-opacity="${f === 0 ? .35 : .08}"/>`).join('');
  const last = pts[pts.length - 1];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">GitHub contributions</title>
<desc id="d">Weekly GitHub contributions over the last 12 months. Total: ${cal.totalContributions}.</desc>
<defs>
<linearGradient id="bd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0EA5E9"/><stop offset=".5" stop-color="#00FFFF"/><stop offset="1" stop-color="#0EA5E9"/></linearGradient>
<linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0EA5E9" stop-opacity=".35"/><stop offset="1" stop-color="#0EA5E9" stop-opacity="0"/></linearGradient>
<linearGradient id="scan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00FFFF" stop-opacity="0"/><stop offset=".5" stop-color="#00FFFF" stop-opacity=".16"/><stop offset="1" stop-color="#00FFFF" stop-opacity="0"/></linearGradient>
<pattern id="lines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#00BFFF" opacity=".045"/></pattern>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6"/></clipPath>
<style>
text{font-family:'Fira Code','JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px}
.k{fill:#7C8BA3}.c{fill:#FFFFFF}.u{fill:#00FFFF}.g{fill:#00FF9C}
.dot{animation:pulse 2.5s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.draw{stroke-dasharray:1400;stroke-dashoffset:1400;animation:draw 3s ease-out forwards}@keyframes draw{to{stroke-dashoffset:0}}
.sc{animation:sweep 9s linear infinite}@keyframes sweep{from{transform:translateX(-90px)}to{transform:translateX(${W}px)}}
@media (prefers-reduced-motion: reduce){.dot{animation:none}.draw{animation:none;stroke-dashoffset:0}.sc{display:none}}
</style>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="#050810"/>
<g clip-path="url(#clip)">
<rect x="1" y="1" width="${W - 2}" height="38" fill="#07101F"/><line x1="1" y1="39" x2="${W - 1}" y2="39" stroke="#0EA5E9" stroke-opacity=".4"/>
<circle class="dot" cx="${W - 150}" cy="20" r="4" fill="#00FF9C" filter="url(#glow)"/><text x="${W - 140}" y="25" class="g" style="letter-spacing:1px">DATA STREAM</text>
<text x="20" y="58" class="k" style="font-size:11px;letter-spacing:1px">SOURCE: GITHUB  //  SYS://CONTRIBUTION</text>
<text x="${W - 20}" y="58" text-anchor="end" class="u" style="font-size:11px;letter-spacing:1px">TOTAL 12 MONTHS: ${cal.totalContributions}</text>
${grid}
<text x="${L - 8}" y="${B + 4}" text-anchor="end" class="k" style="font-size:10px">0</text>
<text x="${L - 8}" y="${T + 4}" text-anchor="end" class="k" style="font-size:10px">${max}</text>
<path d="${area}" fill="url(#ar)"/>
<path d="${line}" class="draw" fill="none" stroke="#00FFFF" stroke-width="1.8" stroke-linejoin="round" filter="url(#glow)"/>
${peaks.map(p => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6" fill="#00BFFF" stroke="#050810"/>`).join('')}
<circle class="dot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4" fill="#FFFFFF" filter="url(#glow)"/>
${labels.join('')}
<rect width="${W}" height="${H}" fill="url(#lines)"/>
<rect class="sc" x="0" y="40" width="90" height="${H - 40}" fill="url(#scan)"/>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="none" stroke="url(#bd)" stroke-opacity=".55"/>
<g fill="none" stroke="#00FFFF" stroke-width="2" filter="url(#glow)"><path d="M1 16V1H16"/><path d="M${W - 16} 1H${W - 1}V16"/><path d="M1 ${H - 16}V${H - 1}H16"/><path d="M${W - 16} ${H - 1}H${W - 1}V${H - 16}"/></g>
</svg>
`;
}

(async () => {
  let cal;
  if (process.argv.includes('--mock')) cal = mockCalendar();
  else {
    const token = process.env.GITHUB_TOKEN;
    const login = process.env.GITHUB_OWNER || process.env.GITHUB_REPOSITORY_OWNER;
    if (!token || !login) { console.error('Set GITHUB_TOKEN and GITHUB_OWNER.'); process.exit(1); }
    cal = await fetchWeeks(login, token);
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(OUT, build(cal));
  console.log(`OK -> ${OUT} (12-month total: ${cal.totalContributions})`);
})().catch(e => { console.error(e.message); process.exit(1); });
