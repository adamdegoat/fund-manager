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

// ── main refresh ──────────────────────────────────────────────
async function refresh() {
  try {
    const [btc, eth, meta] = await Promise.all([
      fetchJSON(BASE + 'btc.json'),
      fetchJSON(BASE + 'eth.json'),
      fetchJSON(BASE + 'meta.json'),
    ]);

    renderCard('btc-card', btc);
    renderCard('eth-card', eth);
    renderSignals(btc, eth);
    renderSentiment(btc, eth);
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
