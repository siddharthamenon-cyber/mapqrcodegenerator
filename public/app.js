const TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

function sanitizeUtm(v) {
  return (v || '').toString().toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
function esc(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fillSelect(el, options, allLabel) {
  const head = allLabel
    ? `<option value="">${allLabel}</option>`
    : el.querySelector('option[value=""]')?.outerHTML || '';
  el.innerHTML = head + options.map(o => `<option value="${o}">${o}</option>`).join('');
}
function buildFinalUrl(rawUrl, params) {
  try {
    const u = new URL(rawUrl);
    Object.entries(params).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
    return u.toString();
  } catch { return ''; }
}
function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function buildQrCanvas(text, logoFile, canvas) {
  const size = 600;
  canvas = canvas || document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: 'H', margin: 2, width: size,
    color: { dark: '#111111', light: '#FFFFFF' },
  });
  if (logoFile) {
    const img = await readFileAsImage(logoFile);
    const ctx = canvas.getContext('2d');
    const logoSize = Math.round(size * 0.22);
    const padding = Math.round(logoSize * 0.12);
    const plate = logoSize + padding * 2;
    const x = (size - plate) / 2;
    const y = (size - plate) / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, plate, plate);
    const ratio = Math.min(logoSize / img.width, logoSize / img.height);
    const w = img.width * ratio, h = img.height * ratio;
    ctx.drawImage(img, x + padding + (logoSize - w) / 2, y + padding + (logoSize - h) / 2, w, h);
  }
  return canvas;
}
async function copyToClipboard(text, btn, fallbackInput) {
  const flash = (label) => {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  // Modern path
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      flash('✓ Copied');
      return true;
    } catch { /* fall through */ }
  }
  // Legacy fallback — select the source input (or a temp textarea) and execCommand.
  try {
    const target = fallbackInput || (() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      return ta;
    })();
    target.focus(); target.select();
    const ok = document.execCommand('copy');
    if (target !== fallbackInput) target.remove();
    if (ok) { flash('✓ Copied'); return true; }
  } catch { /* ignore */ }
  flash('✗ Couldn\'t copy');
  return false;
}

// =========== Tabs ===========
const tabs = document.querySelectorAll('.tab');
const panels = { qr: document.getElementById('panel-qr'), utm: document.getElementById('panel-utm') };
function activateTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(panels).forEach(([k, el]) => { el.hidden = (k !== name); });
}
tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));

// =========== QR Generator (no UTM here anymore) ===========
fillSelect(document.getElementById('team'), TEAMS);
fillSelect(document.getElementById('deployment'), DEPLOYMENTS);

const namePreview = document.getElementById('namePreview');
function updateQrPreview() {
  const team = document.getElementById('team').value;
  const project = document.getElementById('project').value.trim();
  const deployment = document.getElementById('deployment').value;
  const detail = document.getElementById('deployment_detail').value.trim();
  if (!team || !project || !deployment) {
    namePreview.innerHTML = '<span class="pill">Fill in team, project, and deployment to preview</span>';
    return;
  }
  const dep = detail ? `${deployment} (${detail})` : deployment;
  namePreview.innerHTML = `<strong>${esc(team)}</strong> — <strong>${esc(project)}</strong> — <strong>${esc(dep)}</strong>`;
}
['team', 'project', 'deployment', 'deployment_detail'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateQrPreview);
  document.getElementById(id).addEventListener('change', updateQrPreview);
});

const form = document.getElementById('form');
const qrBox = document.getElementById('qr');
const meta = document.getElementById('meta');
const actions = document.getElementById('actions');
const errEl = document.getElementById('err');
const submitBtn = document.getElementById('submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  submitBtn.disabled = true; submitBtn.textContent = 'Generating...';
  try {
    const payload = {
      url: document.getElementById('url').value.trim(),
      team: document.getElementById('team').value,
      project: document.getElementById('project').value.trim(),
      deployment: document.getElementById('deployment').value,
      deployment_detail: document.getElementById('deployment_detail').value.trim(),
    };
    const logoFile = document.getElementById('logo').files[0];

    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    const trackedForQr = data.short_url || data.tracking_url;
    const canvas = await buildQrCanvas(trackedForQr, logoFile);
    qrBox.innerHTML = '';
    qrBox.appendChild(canvas);
    const dataUrl = canvas.toDataURL('image/png');

    meta.innerHTML = `
      <div><strong style="color:var(--text)">${esc(data.label)}</strong></div>
      <div style="margin-top:6px">Tracked link: <code>${esc(trackedForQr)}</code></div>
      <div style="margin-top:6px">Destination: <code>${esc(data.target_url)}</code></div>`;

    const dl = document.getElementById('downloadBtn');
    dl.href = dataUrl;
    dl.download = `qr-${data.team}-${data.project}-${data.id}.png`.replace(/\s+/g, '_');
    document.getElementById('analyticsBtn').href = data.analytics_url;
    actions.style.display = 'flex';

    loadCodes();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = 'Generate QR';
  }
});

// =========== UTM Builder ===========
fillSelect(document.getElementById('u_team'), TEAMS);
document.getElementById('u_team').firstElementChild.textContent = 'Select team…';
fillSelect(document.getElementById('u_deployment'), DEPLOYMENTS);
document.getElementById('u_deployment').firstElementChild.textContent = 'Select…';

const u = {
  team: document.getElementById('u_team'),
  project: document.getElementById('u_project'),
  deployment: document.getElementById('u_deployment'),
  detail: document.getElementById('u_deployment_detail'),
  url: document.getElementById('u_url'),
  source: document.getElementById('u_utm_source'),
  medium: document.getElementById('u_utm_medium'),
  campaign: document.getElementById('u_utm_campaign'),
  content: document.getElementById('u_utm_content'),
  logo: document.getElementById('u_logo'),
  preview: document.getElementById('u_preview'),
  warn: document.getElementById('u_urlWarning'),
  err: document.getElementById('u_err'),
  saveBtn: document.getElementById('u_saveBtn'),
  qrBtn: document.getElementById('u_qrBtn'),
  resultEmpty: document.getElementById('u_resultEmpty'),
  resultLive: document.getElementById('u_resultLive'),
  resultLabel: document.getElementById('u_resultLabel'),
  resultTracked: document.getElementById('u_resultTracked'),
  resultTagged: document.getElementById('u_resultTagged'),
  copyTracked: document.getElementById('u_copyTracked'),
  copyTagged: document.getElementById('u_copyTagged'),
  qrWrap: document.getElementById('u_qrWrap'),
  qrCanvas: document.getElementById('u_qrCanvas'),
  analyticsBtn: document.getElementById('u_analyticsBtn'),
  downloadBtn: document.getElementById('u_downloadBtn'),
  newBtn: document.getElementById('u_newBtn'),
};

// UTM fields are entered manually — no autofill from team/project/deployment.
// Sanitisation still happens (lowercase, no spaces, underscores only).
function uSyncSanitize() {
  u.source.value = sanitizeUtm(u.source.value);
  u.medium.value = sanitizeUtm(u.medium.value);
  u.campaign.value = sanitizeUtm(u.campaign.value);
  u.content.value = sanitizeUtm(u.content.value);
}
['team', 'project', 'deployment', 'detail', 'url'].forEach(k => {
  u[k].addEventListener('input', () => { uUpdatePreview(); uCheckExternal(); });
  u[k].addEventListener('change', () => { uUpdatePreview(); uCheckExternal(); });
});
['source', 'medium', 'campaign', 'content'].forEach(k => {
  u[k].addEventListener('input', () => { uUpdatePreview(); });
  u[k].addEventListener('change', () => { uUpdatePreview(); });
  u[k].addEventListener('blur', () => { uSyncSanitize(); uUpdatePreview(); });
});

function uTaggedUrl() {
  const url = u.url.value.trim();
  const s = sanitizeUtm(u.source.value);
  const m = sanitizeUtm(u.medium.value);
  const c = sanitizeUtm(u.campaign.value);
  const ct = sanitizeUtm(u.content.value);
  if (!url || !s || !m || !c) return '';
  return buildFinalUrl(url, { utm_source: s, utm_medium: m, utm_campaign: c, utm_content: ct });
}
function uUpdatePreview() {
  const final = uTaggedUrl();
  u.preview.innerHTML = final
    ? `<code style="word-break:break-all">${esc(final)}</code>`
    : '<span class="pill">Fill destination URL + source, medium, campaign to preview</span>';
}
function uCheckExternal() {
  const url = u.url.value.trim();
  if (!url) { u.warn.style.display = 'none'; return; }
  try {
    const host = new URL(url).hostname;
    const isMap = /(^|\.)map-india\.org$/i.test(host);
    if (!isMap) {
      u.warn.style.display = 'block';
      u.warn.textContent = `Heads-up: UTMs only register in MAP's GA4 when the visitor lands on map-india.org. ${host} won't be tracked there.`;
    } else {
      u.warn.style.display = 'none';
    }
  } catch { u.warn.style.display = 'none'; }
}

async function uSubmit({ withQr }) {
  u.err.textContent = '';
  if (!u.team.value || !u.project.value.trim() || !u.deployment.value || !u.url.value.trim()) {
    u.err.textContent = 'Fill team, project, deployment, and destination URL.';
    return;
  }
  const s = sanitizeUtm(u.source.value);
  const m = sanitizeUtm(u.medium.value);
  const c = sanitizeUtm(u.campaign.value);
  if (!s || !m || !c) {
    u.err.textContent = 'utm_source, utm_medium, and utm_campaign are required.';
    return;
  }

  // Pre-build the tagged URL and KICK OFF the clipboard write while the user
  // gesture is still active. Safari/iOS reject writeText if the call starts
  // after we've awaited a fetch, so we initiate here, await later.
  const taggedClient = uTaggedUrl();
  let copyPromise = null;
  if (!withQr && taggedClient && navigator.clipboard?.writeText) {
    copyPromise = navigator.clipboard.writeText(taggedClient);
    copyPromise.catch(() => {}); // pre-attach to avoid unhandled rejection warning
  }

  const btn = withQr ? u.qrBtn : u.saveBtn;
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: u.url.value.trim(),
        team: u.team.value,
        project: u.project.value.trim(),
        deployment: u.deployment.value,
        deployment_detail: u.detail.value.trim(),
        utm_source: s,
        utm_medium: m,
        utm_campaign: c,
        utm_content: sanitizeUtm(u.content.value),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    u.resultEmpty.hidden = true;
    u.resultLive.hidden = false;
    u.resultLabel.textContent = data.label;
    // Prefer the short URL for the "tracked link" display; fall back to /r/:id.
    const trackedDisplay = data.short_url || data.tracking_url;
    u.resultTracked.value = trackedDisplay;
    u.resultTagged.value = data.final_url || data.target_url;
    u.analyticsBtn.href = data.analytics_url;

    if (withQr) {
      const logoFile = u.logo.files[0];
      // Encode the short URL when available — denser QRs scan more reliably.
      await buildQrCanvas(trackedDisplay, logoFile, u.qrCanvas);
      u.qrWrap.hidden = false;
      u.downloadBtn.hidden = false;
      u.downloadBtn.href = u.qrCanvas.toDataURL('image/png');
      u.downloadBtn.download = `qr-${data.team}-${data.project}-${data.id}.png`.replace(/\s+/g, '_');
    } else {
      u.qrWrap.hidden = true;
      u.downloadBtn.hidden = true;
      // Resolve the clipboard write started inside the gesture above.
      let copied = false;
      if (copyPromise) {
        try { await copyPromise; copied = true; } catch { copied = false; }
      }
      if (copied) {
        btn.textContent = '✓ Saved & copied';
      } else {
        // Fallback: select the URL so ⌘C / Ctrl+C works one keystroke away.
        u.resultTagged.focus();
        u.resultTagged.select();
        u.err.textContent = 'Saved. Auto-copy was blocked by the browser — the URL is selected: press ⌘C / Ctrl+C, or click the Copy button next to it.';
        btn.textContent = '✓ Saved';
      }
      setTimeout(() => { btn.textContent = original; }, 1800);
    }

    loadCodes();
  } catch (err) {
    u.err.textContent = err.message;
    btn.textContent = original;
  } finally {
    btn.disabled = false;
  }
}

u.saveBtn.addEventListener('click', () => uSubmit({ withQr: false }));
u.qrBtn.addEventListener('click', () => uSubmit({ withQr: true }));
u.copyTracked.addEventListener('click', () => copyToClipboard(u.resultTracked.value, u.copyTracked, u.resultTracked));
u.copyTagged.addEventListener('click', () => copyToClipboard(u.resultTagged.value, u.copyTagged, u.resultTagged));
u.newBtn.addEventListener('click', () => {
  u.resultEmpty.hidden = false;
  u.resultLive.hidden = true;
  document.getElementById('utmForm').reset();
  uUpdatePreview();
  uCheckExternal();
});

// =========== Listing ===========
fillSelect(document.getElementById('filterTeam'), TEAMS, 'All teams');
fillSelect(document.getElementById('filterDeployment'), DEPLOYMENTS, 'All deployments');

let allCodes = [];
async function loadCodes() {
  const res = await fetch('/api/codes');
  allCodes = await res.json();
  renderCodes();
}
function getFiltered() {
  const team = document.getElementById('filterTeam').value;
  const dep = document.getElementById('filterDeployment').value;
  const type = document.getElementById('filterType').value;
  const q = document.getElementById('filterSearch').value.trim().toLowerCase();
  return allCodes.filter(r =>
    (!team || r.team === team) &&
    (!dep || r.deployment === dep) &&
    (!type || (type === 'utm' ? !!r.utm : true)) &&
    (!q
      || (r.project || '').toLowerCase().includes(q)
      || (r.label || '').toLowerCase().includes(q)
      || (r.utm && r.utm.campaign && r.utm.campaign.includes(q)))
  );
}
function renderCodes() {
  const rows = getFiltered();
  const tbody = document.querySelector('#codes tbody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted)">No codes match.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const dep = r.deployment_detail ? `${r.deployment} (${r.deployment_detail})` : (r.deployment || '—');
    const campaign = r.utm ? r.utm.campaign : '<span style="color:var(--muted)">—</span>';
    return `
    <tr>
      <td>${esc(r.team || '—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.project || '—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dep)}</td>
      <td>${typeof campaign === 'string' && r.utm ? esc(campaign) : campaign}</td>
      <td>${r.scan_count}</td>
      <td>${r.last_scan ? new Date(r.last_scan).toLocaleString() : '—'}</td>
      <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
      <td><a href="/analytics.html?id=${r.id}">📊 Analytics</a></td>
    </tr>`;
  }).join('');
}
['filterTeam', 'filterDeployment', 'filterType', 'filterSearch'].forEach(id =>
  document.getElementById(id).addEventListener('input', renderCodes)
);
document.getElementById('refresh').addEventListener('click', loadCodes);

// CSV export of the (filtered) listing.
function csvEscape(v) {
  const s = (v == null ? '' : String(v));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename, rows) {
  const blob = new Blob(['﻿' + rows.map(r => r.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = getFiltered();
  const origin = location.origin;
  const header = ['ID', 'Team', 'Project', 'Deployment', 'Specifics', 'Destination URL',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
    'Tracked URL', 'Tagged URL',
    'Scans', 'Last scan', 'Created at'];
  const data = rows.map(r => {
    const tagged = r.utm ? buildFinalUrl(r.target_url, {
      utm_source: r.utm.source, utm_medium: r.utm.medium,
      utm_campaign: r.utm.campaign, utm_content: r.utm.content || '',
    }) : r.target_url;
    return [
      r.id, r.team, r.project, r.deployment, r.deployment_detail || '',
      r.target_url,
      r.utm?.source || '', r.utm?.medium || '', r.utm?.campaign || '', r.utm?.content || '',
      `${origin}/r/${r.id}`, tagged,
      r.scan_count, r.last_scan ? new Date(r.last_scan).toISOString() : '',
      r.created_at ? new Date(r.created_at).toISOString() : '',
    ];
  });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`map-utm-qr-export-${stamp}.csv`, [header, ...data]);
});

// Init
uUpdatePreview();
updateQrPreview();
loadCodes();
