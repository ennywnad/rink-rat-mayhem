// Rink Rat Mayhem · Game stats: per-team counters, period splits and the stats table
'use strict';
const STAT_ROWS = [
  ['goals', 'Goals'], ['sog', 'Shots on goal'], ['att', 'Shot attempts'], ['saves', 'Saves'], ['hits', 'Hits'], ['kos', 'Knockouts'],
  ['poss', 'Puck possession'], ['passes', 'Passes completed'], ['take', 'Takeaways'], ['ot', 'One-timers'], ['dekes', 'Dekes'], ['pw', 'Power-ups used'],
];
const newStats = () => { const z = () => ({ att:0, saves:0, poss:0, passes:0, passTry:0, take:0, ot:0, dekes:0, pw:0 }); return { home:z(), away:z() }; };
function stat(tm, k, n = 1){ if (G && !G.attract && G.stats && G.stats[tm] && k in G.stats[tm]) G.stats[tm][k] += n; }
function teamStats(tm){
  const s = G.stats ? G.stats[tm] : newStats()[tm];
  return { ...s, goals:G.score[tm], sog:G.sog[tm], hits:G.hits[tm], kos:G.kos[tm] };
}
const teamLabel = tm => {
  if (tm === 'home') return G.mode === 'vs' ? 'P1 · RATS' : 'RATS';
  return G.mode === 'vs' ? `P2 · ${G.ch.opp.abbr}` : G.ch.opp.abbr;
};
// returns the stats table markup; periods (optional) is a list of { home, away } goal splits
function statsTable(periods){
  if (!G) return '';
  const h = teamStats('home'), a = teamStats('away'), tp = h.poss + a.poss;
  const cell = (k, s, o) => {
    if (k === 'poss') return tp > 0.5 ? Math.round(s.poss/tp*100) + '%' : '–';
    if (k === 'passes') return s.passTry ? `${s.passes}/${s.passTry}` : '0';
    return String(s[k]);
  };
  const lead = (k, s, o) => k === 'passes' ? (s.passTry && o.passTry ? s.passes/s.passTry > o.passes/o.passTry : s.passes > o.passes) : s[k] > o[k];
  const split = periods && periods.length > 1 ? `<p class="statsplit">${periods.map((p, i) => `<span>${p.name || periodName(i + 1)} <b>${p.home}–${p.away}</b></span>`).join('')}</p>` : '';
  return `${split}<table class="stats"><thead><tr><th class="sh">${teamLabel('home')}</th><th></th><th class="sa">${teamLabel('away')}</th></tr></thead><tbody>
    ${STAT_ROWS.map(([k, label]) => `<tr><td class="${lead(k, h, a) ? 'lead' : ''}">${cell(k, h, a)}</td><th>${label}</th><td class="${lead(k, a, h) ? 'lead' : ''}">${cell(k, a, h)}</td></tr>`).join('')}
  </tbody></table>`;
}
const periodName = n => n > 3 ? 'OT' : ['1st', '2nd', '3rd'][n - 1];
