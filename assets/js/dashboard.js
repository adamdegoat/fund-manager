'use strict';

const BASE = './data/';
const REFRESH_MS = 2 * 60 * 1000; // re-fetch every 2 minutes

// ── helpers ──────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(isoStr) {
  if (!isoStr) return 'Unknown';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function tfLabel(tf) {
  return { m15: '15 Min', h1: '1 Hour', h4: '4 Hour', daily: 'Daily' }[tf] || tf;
}

function verdictClass(v) {
  return `verdict-${v}`;
}

function tagClass(val) {
  if (!val) return 'tag-neutral';
  const v = val.toLowerCase();
  if (v.includes('bullish'))    return 'tag-bullish';
  if (v.includes('bearish'))    return 'tag-bearish';
  if (v.includes('mixed'))      return 'tag-mixed';
  if (v.includes('overbought')) return 'tag-overbought';
  if (v.includes('oversold'))   return 'tag-oversold';
  return 'tag-neutral';
}

// ── fetch ─────────────────────────────────────────────────────
async function fetchJSON(path) {
  const r = await fetch(path + '?t=' + Date.now());
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ── render asset card ─────────────────────────────────────────
function renderCard(containerId, d) {
  const el = document.getElementById(containerId);
  const isBtc = d.symbol === 'BTC';
  const iconClass = isBtc ? 'btc-icon' : 'eth-icon';
  const cardClass = isBtc ? 'btc-card' : 'eth-card';
  const iconText  = isBtc ? '₿' : 'Ξ';
  const changeDir = d.change_24h >= 0 ? 'up' : 'down';
  const changeTxt = (d.change_24h >= 0 ? '+' : '') + fmt(d.change_24h) + '%';

  el.className = `asset-card ${cardClass}`;

  const m = d.moomoo || {};
  const actionItems = [];
  if (m.note)   actionItems.push({ ok: true,  text: m.note });
  if (m.avoid)  actionItems.push({ ok: false, text: m.avoid });

  const sup = (d.levels?.support  || []).map(p => `<span class="level-item level-support">${fmtPrice(p)}</span>`).join('');
  const res = (d.levels?.resistance || []).map(p => `<span class="level-item level-resistance">${fmtPrice(p)}</span>`).join('');

  el.innerHTML = `
    <div class="card-header">
      <div class="asset-title">
        <div class="asset-icon ${iconClass}">${iconText}</div>
        <div>
          <div class="asset-name">${d.symbol}</div>
          <div class="asset-etf">Moomoo: ${d.etf}</div>
        </div>
      </div>
      <span class="verdict-badge ${verdictClass(d.verdict)}">${d.verdict}</span>
    </div>

    <div class="price-row">
      <span class="price-value">${fmtPrice(d.price)}</span>
      <span class="price-change ${changeDir}">${changeTxt}</span>
    </div>
    <div class="price-sub">24-hour change</div>

    <hr class="card-divider" />

    <p class="summary-text">${d.summary || ''}</p>

    <div class="moomoo-block">
      <div class="moomoo-title">Action for Moomoo (${d.etf})</div>
      ${actionItems.map(a => `
        <div class="moomoo-item">
          <span class="moomoo-icon ${a.ok ? 'ok' : 'warn'}">${a.ok ? '✓' : '✕'}</span>
          <span>${a.text}</span>
        </div>
      `).join('')}
    </div>

    <div class="levels-block">
      <div class="levels-title">Key Price Levels</div>
      <div class="levels-row">
        <div class="level-group">
          <div class="level-label">Support</div>
          ${sup || '<span class="level-item level-support">—</span>'}
        </div>
        <div class="level-group">
          <div class="level-label">Resistance</div>
          ${res || '<span class="level-item level-resistance">—</span>'}
        </div>
      </div>
    </div>
  `;
}

// ── render signal table ───────────────────────────────────────
function renderSignals(btc, eth) {
  const el = document.getElementById('signal-grid');
  const TFS = ['m15', 'h1', 'h4', 'daily'];

  function tableFor(d) {
    const rows = TFS.map(tf => {
      const s = (d.tf_table || {})[tf] || {};
      return `
        <tr>
          <td>${tfLabel(tf)}</td>
          <td><span class="tag ${tagClass(s.trend)}">${s.trend || '—'}</span></td>
          <td>${s.rsi != null ? s.rsi : '—'} <span style="color:var(--text-muted);font-size:10px">${s.rsi_label || ''}</span></td>
          <td><span class="tag ${tagClass(s.macd)}">${s.macd || '—'}</span></td>
          <td>${s.volume || '—'}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="signal-table">
        <thead>
          <tr>
            <th>Timeframe</th>
            <th>Trend</th>
            <th>RSI</th>
            <th>MACD</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  el.innerHTML = `
    <div class="signal-table-wrap">
      <div class="signal-asset-label">Bitcoin (BTC)</div>
      ${tableFor(btc)}
    </div>
    <div class="signal-table-wrap">
      <div class="signal-asset-label">Ethereum (ETH)</div>
      ${tableFor(eth)}
    </div>
  `;
}

// ── render sentiment ──────────────────────────────────────────
function renderSentiment(btc, eth) {
  const el = document.getElementById('sentiment-grid');
  const fg = btc.sentiment?.fear_greed || {};
  const btcF = btc.sentiment?.funding || {};
  const ethF = eth.sentiment?.funding || {};
  const dom  = btc.sentiment?.dominance || {};

  function fgColor(v) {
    if (v >= 75) return 'var(--red)';
    if (v >= 55) return 'var(--yellow)';
    if (v >= 45) return 'var(--text)';
    if (v >= 25) return 'var(--blue)';
    return 'var(--green)';
  }

  el.innerHTML = `
    <div class="sentiment-card">
      <div class="sentiment-label">Fear &amp; Greed Index</div>
      <div class="sentiment-value" style="color:${fgColor(fg.value)}">${fg.value ?? '—'}</div>
      <div class="fg-bar"><div class="fg-bar-fill" style="width:${fg.value ?? 50}%"></div></div>
      <div class="sentiment-desc">${fg.label || '—'}</div>
    </div>

    <div class="sentiment-card">
      <div class="sentiment-label">BTC Funding Rate</div>
      <div class="sentiment-value" style="color:${btcF.rate > 0.1 ? 'var(--orange)' : 'var(--text)'}">
        ${btcF.rate != null ? btcF.rate + '%' : '—'}
      </div>
      <div class="sentiment-desc">${btcF.label || '—'}</div>
    </div>

    <div class="sentiment-card">
      <div class="sentiment-label">ETH Funding Rate</div>
      <div class="sentiment-value" style="color:${ethF.rate > 0.1 ? 'var(--orange)' : 'var(--text)'}">
        ${ethF.rate != null ? ethF.rate + '%' : '—'}
      </div>
      <div class="sentiment-desc">${ethF.label || '—'}</div>
    </div>

    <div class="sentiment-card">
      <div class="sentiment-label">BTC Dominance</div>
      <div class="sentiment-value">${dom.btc != null ? dom.btc + '%' : '—'}</div>
      <div class="sentiment-desc">ETH: ${dom.eth != null ? dom.eth + '%' : '—'} of total market</div>
    </div>
  `;
}

// ── render news ───────────────────────────────────────────────
function renderNews(btc, eth) {
  const el = document.getElementById('news-grid');

  function newsFor(items, label) {
    if (!items || !items.length) {
      return `<div class="news-asset-label">${label}</div><div class="news-empty">No headlines at this time.</div>`;
    }
    const rows = items.map(n => `
      <div class="news-item">
        <span class="news-dot ${n.sentiment}"></span>
        <div class="news-title">
          ${n.url ? `<a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>` : n.title}
        </div>
      </div>
    `).join('');
    return `<div class="news-asset-label">${label}</div>${rows}`;
  }

  el.innerHTML = `
    <div>${newsFor(btc.news, 'Bitcoin')}</div>
    <div>${newsFor(eth.news, 'Ethereum')}</div>
  `;
}

// ── render update pill ────────────────────────────────────────
function renderMeta(meta) {
  const el = document.getElementById('update-text');
  if (!meta) { el.textContent = 'Data unavailable'; return; }
  el.textContent = `Updated ${timeAgo(meta.last_updated)}`;
}

// ── render L9 intelligence panel ─────────────────────────────
function renderL9(l9) {
  const el = document.getElementById('l9-grid');
  if (!l9) { el.innerHTML = '<div class="l9-empty"><p>L9 data unavailable</p></div>'; return; }

  const active   = l9.active_count   ?? 0;
  const paper    = l9.paper_count    ?? 0;
  const promoted = l9.promoted_count ?? 0;
  const retired  = l9.retired_count  ?? 0;
  const rejected = l9.rejected_count ?? 0;

  const strats = l9.active_strategies || [];

  const statsHtml = `
    <div class="l9-stats">
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:var(--blue)">${active}</div>
        <div class="l9-stat-label">Active Strategies</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:var(--green)">${promoted}</div>
        <div class="l9-stat-label">Promoted</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:var(--blue)">${paper}</div>
        <div class="l9-stat-label">In Paper</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:var(--text-muted)">${retired}</div>
        <div class="l9-stat-label">Retired</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:var(--text-muted)">${rejected}</div>
        <div class="l9-stat-label">Rejected</div>
      </div>
    </div>
  `;

  let tableHtml = '';
  if (strats.length === 0) {
    tableHtml = `
      <div class="l9-empty">
        <p>No active strategies yet.</p>
        <small>The L9 engine invents strategies weekly. First cycle will populate this table.</small>
      </div>
    `;
  } else {
    const rows = strats.map(s => `
      <tr>
        <td style="color:var(--text);font-weight:500">${s.name}</td>
        <td><span class="tag tag-neutral">${s.family.replace(/_/g,' ')}</span></td>
        <td>${s.asset}</td>
        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
        <td>${s.promoted_at || '—'}</td>
      </tr>
    `).join('');
    tableHtml = `
      <div class="strategy-table-wrap">
        <table class="strategy-table">
          <thead><tr>
            <th>Strategy</th><th>Family</th><th>Asset</th><th>Status</th><th>Since</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  el.innerHTML = statsHtml + tableHtml;
}

// ── render paper portfolio ────────────────────────────────────
let equityChart = null;

function renderPortfolio(l9) {
  const el = document.getElementById('portfolio-grid');
  if (!l9 || !l9.portfolio) {
    el.innerHTML = '<div class="l9-empty"><p>Portfolio data unavailable</p></div>';
    return;
  }

  const p   = l9.portfolio;
  const roi = p.roi_pct ?? 0;
  const wr  = p.win_rate != null ? (p.win_rate * 100).toFixed(1) + '%' : '—';
  const roiColor = roi >= 0 ? 'var(--green)' : 'var(--red)';
  const roiSign  = roi >= 0 ? '+' : '';

  const headerHtml = `
    <div class="portfolio-header">
      <div class="l9-stat-card">
        <div class="l9-stat-value">$${fmt(p.equity)}</div>
        <div class="l9-stat-label">Portfolio Value</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value" style="color:${roiColor}">${roiSign}${fmt(roi)}%</div>
        <div class="l9-stat-label">Total ROI</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value">${p.open_trades ?? 0}</div>
        <div class="l9-stat-label">Open Trades</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value">${wr}</div>
        <div class="l9-stat-label">Win Rate</div>
      </div>
      <div class="l9-stat-card">
        <div class="l9-stat-value">${p.total_trades ?? 0}</div>
        <div class="l9-stat-label">Total Trades</div>
      </div>
    </div>
  `;

  // equity chart
  const chartHtml = `<div class="portfolio-chart-wrap"><canvas id="equity-chart"></canvas></div>`;

  // open positions
  let openHtml = '';
  const openPos = p.open_positions || [];
  if (openPos.length > 0) {
    const rows = openPos.map(t => {
      const upnl = t.unrealised_pct ?? 0;
      const cls  = upnl >= 0 ? 'pnl-pos' : 'pnl-neg';
      const sign = upnl >= 0 ? '+' : '';
      return `<tr>
        <td style="color:var(--text)">${t.strategy_name || t.strategy_id}</td>
        <td>${t.asset}</td>
        <td>$${fmt(t.entry_price)}</td>
        <td>$${fmt(t.current_price)}</td>
        <td class="${cls}">${sign}${fmt(upnl)}%</td>
        <td>${t.days_held ?? 0}d</td>
      </tr>`;
    }).join('');
    openHtml = `
      <div class="trades-section">
        <div class="trades-title">Open Positions (${openPos.length})</div>
        <table class="trades-table">
          <thead><tr><th>Strategy</th><th>Asset</th><th>Entry</th><th>Current</th><th>Unrealised</th><th>Days</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // recent closed trades
  let closedHtml = '';
  const recent = (p.recent_trades || []).slice().reverse().slice(0, 8);
  if (recent.length > 0) {
    const rows = recent.map(t => {
      const pnl = t.pnl_pct ?? 0;
      const cls = pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
      const sign = pnl >= 0 ? '+' : '';
      return `<tr>
        <td style="color:var(--text)">${t.strategy_name || t.strategy_id || '—'}</td>
        <td>${t.asset}</td>
        <td>${t.entry_date}</td>
        <td>${t.exit_date}</td>
        <td class="${cls}">${sign}${fmt(pnl)}%</td>
        <td class="${cls}">$${fmt(t.pnl_dollar ?? 0)}</td>
      </tr>`;
    }).join('');
    closedHtml = `
      <div class="trades-section" style="margin-top:20px">
        <div class="trades-title">Recent Closed Trades</div>
        <table class="trades-table">
          <thead><tr><th>Strategy</th><th>Asset</th><th>Entry</th><th>Exit</th><th>P&amp;L %</th><th>P&amp;L $</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } else {
    closedHtml = '<div class="l9-empty" style="padding:16px"><small>No completed trades yet — strategies are paper incubating.</small></div>';
  }

  el.innerHTML = headerHtml + chartHtml + openHtml + closedHtml;

  // draw equity curve
  const history = p.equity_history || [];
  if (history.length > 1 && window.Chart) {
    const ctx = document.getElementById('equity-chart');
    if (equityChart) equityChart.destroy();
    equityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(h => h.date),
        datasets: [{
          data: history.map(h => h.equity),
          borderColor: '#4a9eff',
          backgroundColor: 'rgba(74,158,255,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => '$' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits:2}) }
        }},
        scales: {
          x: { display: false },
          y: {
            grid: { color: 'rgba(30,45,69,0.5)' },
            ticks: { color: '#4a5d78', font: { size: 10 },
              callback: v => '$' + (v/1000).toFixed(1) + 'k' }
          }
        }
      }
    });
  } else if (history.length <= 1) {
    const ctx = document.getElementById('equity-chart');
    if (ctx) ctx.parentElement.innerHTML = '<div class="l9-empty" style="padding:20px"><small>Equity curve will appear after the first completed trade.</small></div>';
  }
}

// ── main refresh ──────────────────────────────────────────────
async function refresh() {
  try {
    const [btc, eth, meta, l9] = await Promise.all([
      fetchJSON(BASE + 'btc.json'),
      fetchJSON(BASE + 'eth.json'),
      fetchJSON(BASE + 'meta.json'),
      fetchJSON(BASE + 'l9.json').catch(() => null),
    ]);

    renderCard('btc-card', btc);
    renderCard('eth-card', eth);
    renderSignals(btc, eth);
    renderSentiment(btc, eth);
    renderL9(l9);
    renderPortfolio(l9);
    renderNews(btc, eth);
    renderMeta(meta);
  } catch (err) {
    document.getElementById('update-text').textContent = 'Failed to load — retrying';
    console.error('Dashboard fetch error:', err);
  }
}

// ── live "X min ago" counter ──────────────────────────────────
let lastMeta = null;

async function updateTimestamp() {
  try {
    const meta = await fetchJSON(BASE + 'meta.json');
    lastMeta = meta;
  } catch (_) {}
  if (lastMeta) renderMeta(lastMeta);
}

refresh();
setInterval(refresh, REFRESH_MS);
setInterval(updateTimestamp, 30_000);
