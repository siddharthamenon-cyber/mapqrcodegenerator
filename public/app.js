const TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

// MAP UTM conventions: medium is always 'qr' for QR codes; source is qr_<placement>.
const UTM_SOURCE_BY_DEPLOYMENT = {
  'Website': 'qr_web',
  'Gallery': 'qr_gallery',
  'Physical location outside museum': 'qr_outdoor',
  'Email / Newsletter': 'qr_email',
  'Print collateral': 'qr_print',
  'Social media': 'qr_social',
  'Other': 'qr',
};

// Five golden rules in code: no caps, no spaces, no special chars (underscores allowed).
function sanitizeUtm(v) {
  return (v || '').toString().toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function fillSelect(el, options, allLabel) {
  const head = allLabel
    ? `<option value="">${allLabel}</option>`
    : el.querySelector('option[value=""]')?.outerHTML || '';
  el.innerHTML = head + options.map(o => `<option value="${o}">${o}</option>`).join('');
}

fillSelect(document.getElementById('team'), TEAMS);
fillSelect(document.getElementById('deployment'), DEPLOYMENTS);
fillSelect(document.getElementById('filterTeam'), TEAMS, 'All teams');
fillSelect(document.getElementById('filterDeployment'), DEPLOYMENTS, 'All deployments');

const namePreview = document.getElementById('namePreview');
function updatePreview() {
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
  document.getElementById(id).addEventListener('input', updatePreview);
  document.getElementById(id).addEventListener('change', updatePreview);
});

// ---------- UTM section ----------
const utmEnabledEl = document.getElementById('utmEnabled');
const utmBlock = document.querySelector('.utm-block');
const utmSourceEl = document.getElementById('utm_source');
const utmMediumEl = document.getElementById('utm_medium');
const utmCampaignEl = document.getElementById('utm_campaign');
const utmContentEl = document.getElementById('utm_content');
const utmPreviewEl = document.getElementById('utmPreview');
const urlEl = document.getElementById('url');
const urlWarning = document.getElementById('urlWarning');

const utmTouched = { source: false, medium: false, campaign: false, content: false };
[utmSourceEl, utmMediumEl, utmCampaignEl, utmContentEl].forEach(el => {
  const key = el.id.replace('utm_', '');
  el.addEventListener('input', () => { utmTouched[key] = true; });
});

function autofillUtm() {
  const deployment = document.getElementById('deployment').value;
  const project = document.getElementById('project').value.trim();
  const detail = document.getElementById('deployment_detail').value.trim();
  if (!utmTouched.medium) utmMediumEl.value = 'qr';
  if (!utmTouched.source && deployment) utmSourceEl.value = UTM_SOURCE_BY_DEPLOYMENT[deployment] || 'qr';
  if (!utmTouched.campaign && project) utmCampaignEl.value = sanitizeUtm(project);
  if (!utmTouched.content && detail) utmContentEl.value = sanitizeUtm(detail);
  // Live-sanitize whatever's in the fields (covers paste).
  utmSourceEl.value = sanitizeUtm(utmSourceEl.value);
  utmMediumEl.value = sanitizeUtm(utmMediumEl.value);
  utmCampaignEl.value = sanitizeUtm(utmCampaignEl.value);
  utmContentEl.value = sanitizeUtm(utmContentEl.value);
  updateUtmPreview();
}

['team', 'project', 'deployment', 'deployment_detail'].forEach(id => {
  document.getElementById(id).addEventListener('input', autofillUtm);
  document.getElementById(id).addEventListener('change', autofillUtm);
});

function buildFinalUrl(rawUrl, params) {
  try {
    const u = new URL(rawUrl);
    Object.entries(params).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
    return u.toString();
  } catch { return ''; }
}

function updateUtmPreview() {
  const enabled = utmEnabledEl.checked;
  utmBlock.classList.toggle('disabled', !enabled);
  if (!enabled) {
    utmPreviewEl.innerHTML = '<span class="pill">UTM tracking disabled — destination URL will be used as-is</span>';
    return;
  }
  const url = urlEl.value.trim();
  const s = sanitizeUtm(utmSourceEl.value);
  const m = sanitizeUtm(utmMediumEl.value);
  const c = sanitizeUtm(utmCampaignEl.value);
  const ct = sanitizeUtm(utmContentEl.value);
  if (!url || !s || !m || !c) {
    utmPreviewEl.innerHTML = '<span class="pill">Fill destination URL + source, medium, campaign to preview</span>';
    return;
  }
  const final = buildFinalUrl(url, { utm_source: s, utm_medium: m, utm_campaign: c, utm_content: ct });
  utmPreviewEl.innerHTML = final
    ? `<code style="word-break:break-all">${esc(final)}</code>`
    : '<span class="pill">Invalid URL</span>';
}

function checkExternalRule() {
  const url = urlEl.value.trim();
  if (!url) { urlWarning.style.display = 'none'; return; }
  try {
    const host = new URL(url).hostname;
    const isMap = /(^|\.)map-india\.org$/i.test(host);
    if (!isMap && utmEnabledEl.checked) {
      urlWarning.style.display = 'block';
      urlWarning.textContent = `Heads-up: UTMs only register in MAP's GA4 when the visitor lands on map-india.org. ${host} won't be tracked there.`;
    } else {
      urlWarning.style.display = 'none';
    }
  } catch { urlWarning.style.display = 'none'; }
}

[utmEnabledEl, utmSourceEl, utmMediumEl, utmCampaignEl, utmContentEl, urlEl].forEach(el => {
  el.addEventListener('input', () => { updateUtmPreview(); checkExternalRule(); });
  el.addEventListener('change', () => { updateUtmPreview(); checkExternalRule(); });
});

// Sanitize on blur so users see exactly what'll be sent.
[utmSourceEl, utmMediumEl, utmCampaignEl, utmContentEl].forEach(el => {
  el.addEventListener('blur', () => { el.value = sanitizeUtm(el.value); updateUtmPreview(); });
});

// Initialize defaults.
utmMediumEl.value = 'qr';
updateUtmPreview();

// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab');
const panels = { qr: document.getElementById('panel-qr'), utm: document.getElementById('panel-utm') };
function activateTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(panels).forEach(([k, el]) => { el.hidden = (k !== name); });
}
tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));

// ---------- UTM Builder (standalone tab) ----------
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
  preview: document.getElementById('u_preview'),
  warn: document.getElementById('u_urlWarning'),
  err: document.getElementById('u_err'),
  copyBtn: document.getElementById('u_copyBtn'),
  qrBtn: document.getElementById('u_qrBtn'),
};

const uTouched = { source: false, medium: false, campaign: false, content: false };
[['source', u.source], ['medium', u.medium], ['campaign', u.campaign], ['content', u.content]].forEach(([k, el]) => {
  el.addEventListener('input', () => { uTouched[k] = true; });
});

function uAutofill() {
  if (!uTouched.medium) u.medium.value = 'qr';
  if (!uTouched.source && u.deployment.value) u.source.value = UTM_SOURCE_BY_DEPLOYMENT[u.deployment.value] || 'qr';
  if (!uTouched.campaign && u.project.value.trim()) u.campaign.value = sanitizeUtm(u.project.value);
  if (!uTouched.content && u.detail.value.trim()) u.content.value = sanitizeUtm(u.detail.value);
  u.source.value = sanitizeUtm(u.source.value);
  u.medium.value = sanitizeUtm(u.medium.value);
  u.campaign.value = sanitizeUtm(u.campaign.value);
  u.content.value = sanitizeUtm(u.content.value);
  uUpdatePreview();
  uCheckExternal();
}
['team', 'project', 'deployment', 'detail', 'url', 'source', 'medium', 'campaign', 'content'].forEach(k => {
  u[k].addEventListener('input', uAutofill);
  u[k].addEventListener('change', uAutofill);
});
[u.source, u.medium, u.campaign, u.content].forEach(el => {
  el.addEventListener('blur', () => { el.value = sanitizeUtm(el.value); uUpdatePreview(); });
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

u.copyBtn.addEventListener('click', async () => {
  const final = uTaggedUrl();
  if (!final) { u.err.textContent = 'Fill the required fields first.'; return; }
  u.err.textContent = '';
  try {
    await navigator.clipboard.writeText(final);
    const original = u.copyBtn.textContent;
    u.copyBtn.textContent = '✓ Copied';
    setTimeout(() => { u.copyBtn.textContent = original; }, 1500);
  } catch {
    u.err.textContent = 'Copy failed — select the URL above and copy manually.';
  }
});

// Convert UTM → QR: prefill the QR form, switch tab, scroll to top.
u.qrBtn.addEventListener('click', () => {
  if (!u.team.value || !u.project.value.trim() || !u.deployment.value || !u.url.value.trim()) {
    u.err.textContent = 'Fill team, project, deployment, and destination URL before generating a QR.';
    return;
  }
  u.err.textContent = '';
  document.getElementById('team').value = u.team.value;
  document.getElementById('project').value = u.project.value;
  document.getElementById('deployment').value = u.deployment.value;
  document.getElementById('deployment_detail').value = u.detail.value;
  document.getElementById('url').value = u.url.value;
  utmEnabledEl.checked = true;
  utmSourceEl.value = u.source.value;
  utmMediumEl.value = u.medium.value;
  utmCampaignEl.value = u.campaign.value;
  utmContentEl.value = u.content.value;
  // Mark touched so QR-tab autofill doesn't overwrite the user's UTM choices.
  utmTouched.source = utmTouched.medium = utmTouched.campaign = true;
  if (u.content.value) utmTouched.content = true;
  updatePreview();
  updateUtmPreview();
  checkExternalRule();
  activateTab('qr');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const form = document.getElementById('form');
const qrBox = document.getElementById('qr');
const meta = document.getElementById('meta');
const actions = document.getElementById('actions');
const errEl = document.getElementById('err');
const submit = document.getElementById('submit');

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

async function buildQrCanvas(text, logoFile) {
  const size = 600;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  submit.disabled = true; submit.textContent = 'Generating...';
  try {
    const payload = {
      url: document.getElementById('url').value.trim(),
      team: document.getElementById('team').value,
      project: document.getElementById('project').value.trim(),
      deployment: document.getElementById('deployment').value,
      deployment_detail: document.getElementById('deployment_detail').value.trim(),
    };
    if (utmEnabledEl.checked) {
      payload.utm_source = sanitizeUtm(utmSourceEl.value);
      payload.utm_medium = sanitizeUtm(utmMediumEl.value);
      payload.utm_campaign = sanitizeUtm(utmCampaignEl.value);
      payload.utm_content = sanitizeUtm(utmContentEl.value);
    }
    const logoFile = document.getElementById('logo').files[0];

    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    const canvas = await buildQrCanvas(data.tracking_url, logoFile);
    qrBox.innerHTML = '';
    qrBox.appendChild(canvas);
    const dataUrl = canvas.toDataURL('image/png');

    const finalLine = data.utm
      ? `<div style="margin-top:6px">Tagged destination: <code>${esc(data.final_url)}</code></div>`
      : '';
    meta.innerHTML = `
      <div><strong style="color:var(--text)">${esc(data.label)}</strong></div>
      <div style="margin-top:6px">Tracking URL: <code>${data.tracking_url}</code></div>
      <div style="margin-top:6px">Destination: <code>${data.target_url}</code></div>
      ${finalLine}`;

    const dl = document.getElementById('downloadBtn');
    dl.href = dataUrl;
    dl.download = `qr-${data.team}-${data.project}-${data.id}.png`.replace(/\s+/g, '_');
    document.getElementById('analyticsBtn').href = data.analytics_url;
    actions.style.display = 'flex';

    loadCodes();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    submit.disabled = false; submit.textContent = 'Generate QR';
  }
});

let allCodes = [];
async function loadCodes() {
  const res = await fetch('/api/codes');
  allCodes = await res.json();
  renderCodes();
}
function renderCodes() {
  const team = document.getElementById('filterTeam').value;
  const dep = document.getElementById('filterDeployment').value;
  const q = document.getElementById('filterSearch').value.trim().toLowerCase();
  const rows = allCodes.filter(r =>
    (!team || r.team === team) &&
    (!dep || r.deployment === dep) &&
    (!q || (r.project || '').toLowerCase().includes(q) || (r.label || '').toLowerCase().includes(q))
  );
  const tbody = document.querySelector('#codes tbody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">No codes match.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const dep = r.deployment_detail ? `${r.deployment} (${r.deployment_detail})` : (r.deployment || '—');
    return `
    <tr>
      <td>${esc(r.team || '—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.project || '—')}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dep)}</td>
      <td>${r.scan_count}</td>
      <td>${r.last_scan ? new Date(r.last_scan).toLocaleString() : '—'}</td>
      <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
      <td><a href="/analytics.html?id=${r.id}">📊 Analytics</a></td>
    </tr>`;
  }).join('');
}
['filterTeam', 'filterDeployment', 'filterSearch'].forEach(id =>
  document.getElementById(id).addEventListener('input', renderCodes)
);
function esc(s) { return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
document.getElementById('refresh').addEventListener('click', loadCodes);
loadCodes();
