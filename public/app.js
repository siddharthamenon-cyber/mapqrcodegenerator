const TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

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

    meta.innerHTML = `
      <div><strong style="color:var(--text)">${esc(data.label)}</strong></div>
      <div style="margin-top:6px">Tracking URL: <code>${data.tracking_url}</code></div>
      <div style="margin-top:6px">Destination: <code>${data.target_url}</code></div>`;

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
