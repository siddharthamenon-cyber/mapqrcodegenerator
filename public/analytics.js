const id = new URLSearchParams(location.search).get('id');

function esc(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

(async () => {
  if (!id) { document.getElementById('title').textContent = 'Missing id'; return; }
  const res = await fetch(`/api/stats/${id}`);
  if (!res.ok) { document.getElementById('title').textContent = 'Not found'; return; }
  const d = await res.json();
  const c = d.code;

  document.getElementById('title').textContent = c.project || c.label || `QR ${c.id}`;
  document.getElementById('sub').innerHTML =
    `Destination: <code>${esc(c.target_url)}</code> · Tracking: <code>${location.origin}/r/${c.id}</code>`;

  const tags = document.getElementById('tags');
  const dep = c.deployment_detail ? `${c.deployment} (${c.deployment_detail})` : c.deployment;
  tags.innerHTML = [
    c.team && `<span class="tag">Team: <b>${esc(c.team)}</b></span>`,
    c.project && `<span class="tag">Project: <b>${esc(c.project)}</b></span>`,
    dep && `<span class="tag">Deployment: <b>${esc(dep)}</b></span>`,
    c.created_at && `<span class="tag">Created: <b>${new Date(c.created_at).toLocaleDateString()}</b></span>`,
  ].filter(Boolean).join('');

  document.getElementById('total').textContent = d.total_scans;
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = d.scans_by_day.find(x => x.day === today);
  document.getElementById('today').textContent = todayRow ? todayRow.count : 0;
  document.getElementById('last').textContent = d.recent_scans[0]
    ? new Date(d.recent_scans[0].scanned_at).toLocaleString()
    : '—';

  const max = Math.max(1, ...d.scans_by_day.map(x => x.count));
  document.getElementById('byday').innerHTML = `
    <thead><tr><th>Day</th><th>Count</th><th></th></tr></thead>
    <tbody>${d.scans_by_day.map(x => `
      <tr><td>${x.day}</td><td>${x.count}</td><td><div class="bar" style="width:${(x.count / max * 100).toFixed(1)}%"></div></td></tr>`).join('')
      || '<tr><td colspan="3" class="muted">No scans yet.</td></tr>'}
    </tbody>`;

  const tbody = document.querySelector('#recent tbody');
  tbody.innerHTML = d.recent_scans.length
    ? d.recent_scans.map(s => `
      <tr>
        <td>${new Date(s.scanned_at).toLocaleString()}</td>
        <td>${esc(s.ip)}</td>
        <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis">${esc(s.user_agent)}</td>
        <td>${esc(s.referer) || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="muted">No scans yet — share your QR to start tracking.</td></tr>';
})();
