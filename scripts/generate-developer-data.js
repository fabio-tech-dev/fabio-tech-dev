#!/usr/bin/env node
/**
 * Generate dist/developer-data.svg with real GitHub repository, contribution,
 * and language data for the profile activity panel.
 *
 * Usage (GitHub Actions): GITHUB_TOKEN=... GITHUB_OWNER=user node scripts/generate-developer-data.js
 * Offline local test:     node scripts/generate-developer-data.js --mock
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join('dist', 'developer-data.svg');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function fetchData(login, token) {
  const query = `query($login:String!){user(login:$login){
    followers{totalCount}
    repositories(ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC,first:100){totalCount nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
    contributionsCollection{totalCommitContributions totalPullRequestContributions totalIssueContributions contributionCalendar{totalContributions}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'developer-data' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);
  const json = await res.json();
  if (json.errors || !json.data || !json.data.user) throw new Error('GitHub query failed: ' + JSON.stringify(json.errors || json));
  const u = json.data.user, cc = u.contributionsCollection;
  const langs = {};
  let stars = 0;
  for (const r of u.repositories.nodes) {
    stars += r.stargazerCount;
    for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
  }
  return {
    repos: u.repositories.totalCount, stars, followers: u.followers.totalCount,
    commits: cc.totalCommitContributions, prs: cc.totalPullRequestContributions, issues: cc.totalIssueContributions,
    total: cc.contributionCalendar.totalContributions, langs,
  };
}

const mock = () => ({ repos: 9, stars: 3, followers: 5, commits: 70, prs: 4, issues: 1, total: 87,
  langs: { HTML: 52000, CSS: 31000, JavaScript: 24000, Python: 6000, PHP: 2000 } });

function build(d) {
  const W = 600;
  const entries = Object.entries(d.langs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sum = Object.values(d.langs).reduce((s, v) => s + v, 0) || 1;
  const stats = [['PUBLIC REPOS', d.repos], ['STARS RECEIVED', d.stars], ['COMMITS // 12M', d.commits],
                 ['PULL REQUESTS // 12M', d.prs], ['ISSUES // 12M', d.issues]];
  const rowH = 30, top = 86;
  const H = Math.max(top + stats.length * rowH + 20, top + Math.max(entries.length, 1) * 36 + 24);
  const shades = ['#00FFFF', '#00BFFF', '#0EA5E9', '#2A7FB8', '#3A6A92'];

  const statRows = stats.map(([k, v], i) => {
    const y = top + i * rowH;
    return `<g class="l" style="animation-delay:${(0.3 + i * 0.25).toFixed(2)}s"><text x="26" y="${y}" class="k" style="font-size:12px;letter-spacing:1px">${esc(k)}</text><text x="276" y="${y}" text-anchor="end" class="c" style="font-size:18px;font-weight:700">${v}</text><line x1="26" y1="${y + 9}" x2="276" y2="${y + 9}" stroke="#0EA5E9" stroke-opacity=".18"/></g>`;
  }).join('');

  const BX = 330, BW = 240;
  const langRows = (entries.length ? entries : [['—', 1]]).map(([n, v], i) => {
    const y = top + i * 36, pct = (v / sum) * 100, bw = Math.max(3, (BW * pct) / 100);
    return `<g class="l" style="animation-delay:${(0.4 + i * 0.25).toFixed(2)}s"><text x="${BX}" y="${y}" class="o" style="font-size:13px">${esc(n)}</text><text x="${BX + BW}" y="${y}" text-anchor="end" class="u" style="font-size:12px">${pct.toFixed(1)}%</text>`
      + `<rect x="${BX}" y="${y + 7}" width="${BW}" height="5" rx="2" fill="#0EA5E9" fill-opacity=".12"/><rect x="${BX}" y="${y + 7}" width="${bw.toFixed(1)}" height="5" rx="2" fill="${shades[i]}" filter="url(#glow)"/></g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">Developer data — GitHub</title>
<desc id="d">Public repositories: ${d.repos}. Stars: ${d.stars}. Commits in the last 12 months: ${d.commits}. Languages: ${entries.map(e => esc(e[0])).join(', ')}.</desc>
<defs>
<linearGradient id="bd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0EA5E9"/><stop offset=".5" stop-color="#00FFFF"/><stop offset="1" stop-color="#0EA5E9"/></linearGradient>
<linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00FFFF" stop-opacity="0"/><stop offset=".5" stop-color="#00FFFF" stop-opacity=".10"/><stop offset="1" stop-color="#00FFFF" stop-opacity="0"/></linearGradient>
<pattern id="lines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#00BFFF" opacity=".045"/></pattern>
<pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#0EA5E9" stroke-opacity=".05"/></pattern>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6"/></clipPath>
<style>
text{font-family:'Fira Code','JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px}
.k{fill:#7C8BA3}.c{fill:#FFFFFF}.u{fill:#00FFFF}.o{fill:#D5E1F2}.g{fill:#00FF9C}.n{fill:#00BFFF}
.l{opacity:0;animation:show .35s ease-out forwards}@keyframes show{to{opacity:1}}
.dot{animation:pulse 2.5s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.sc{animation:sweep 9s linear infinite}@keyframes sweep{from{transform:translateY(-60px)}to{transform:translateY(${H}px)}}
@media (prefers-reduced-motion: reduce){.l{opacity:1;animation:none}.dot{animation:none}.sc{display:none}}
</style>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="#050810"/>
<g clip-path="url(#clip)">
<rect width="${W}" height="${H}" fill="url(#grid)"/>
<rect x="1" y="1" width="${W - 2}" height="38" fill="#07101F"/><line x1="1" y1="39" x2="${W - 1}" y2="39" stroke="#0EA5E9" stroke-opacity=".4"/>
<text x="20" y="25" class="c" style="font-weight:600;letter-spacing:1.5px;font-size:14px">DEV // GITHUB DATA</text>
<circle class="dot" cx="${W - 132}" cy="20" r="4" fill="#00FF9C" filter="url(#glow)"/><text x="${W - 122}" y="25" class="g" style="letter-spacing:1px;font-size:12px">SOURCE : GITHUB</text>
<text x="26" y="64" class="n" style="font-size:12px;letter-spacing:3px">STATS</text><line x1="76" y1="60" x2="276" y2="60" stroke="#0EA5E9" stroke-opacity=".4"/>
<text x="${BX}" y="64" class="n" style="font-size:12px;letter-spacing:3px">LANGUAGES</text><line x1="${BX + 100}" y1="60" x2="${BX + BW}" y2="60" stroke="#0EA5E9" stroke-opacity=".4"/>
<line x1="303" y1="52" x2="303" y2="${H - 16}" stroke="#0EA5E9" stroke-opacity=".25"/>
${statRows}${langRows}
<rect width="${W}" height="${H}" fill="url(#lines)"/><rect class="sc" x="1" y="0" width="${W - 2}" height="60" fill="url(#scan)"/>
</g>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" fill="none" stroke="url(#bd)" stroke-opacity=".55"/>
<g fill="none" stroke="#00FFFF" stroke-width="2" filter="url(#glow)"><path d="M1 16V1H16"/><path d="M${W - 16} 1H${W - 1}V16"/><path d="M1 ${H - 16}V${H - 1}H16"/><path d="M${W - 16} ${H - 1}H${W - 1}V${H - 16}"/></g>
</svg>
`;
}

(async () => {
  let data;
  if (process.argv.includes('--mock')) data = mock();
  else {
    const token = process.env.GITHUB_TOKEN, login = process.env.GITHUB_OWNER || process.env.GITHUB_REPOSITORY_OWNER;
    if (!token || !login) { console.error('Set GITHUB_TOKEN and GITHUB_OWNER.'); process.exit(1); }
    data = await fetchData(login, token);
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(OUT, build(data));
  console.log(`OK -> ${OUT}`);
})().catch(e => { console.error(e.message); process.exit(1); });
