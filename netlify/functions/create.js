import { codesStore, genId, json } from './_lib.js';

const ALLOWED_TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const ALLOWED_DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

function buildLabel({ team, project, deployment, deployment_detail }) {
  const dep = deployment_detail ? `${deployment} (${deployment_detail})` : deployment;
  return `${team} — ${project} — ${dep}`;
}

// MAP's golden rules: no caps, no spaces, no special chars (underscores only).
function sanitizeUtm(v) {
  if (!v) return '';
  return String(v).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  const url = (body.url || '').trim();
  const team = (body.team || '').trim();
  const project = (body.project || '').trim();
  const deployment = (body.deployment || '').trim();
  const deployment_detail = (body.deployment_detail || '').trim() || null;

  if (!/^https?:\/\/.+/i.test(url)) return json({ error: 'URL must start with http:// or https://' }, { status: 400 });
  if (!ALLOWED_TEAMS.includes(team)) return json({ error: 'Invalid team' }, { status: 400 });
  if (!project) return json({ error: 'Project name is required' }, { status: 400 });
  if (!ALLOWED_DEPLOYMENTS.includes(deployment)) return json({ error: 'Invalid deployment location' }, { status: 400 });

  // Optional UTM tags — sanitised per MAP's golden rules.
  const utm_source = sanitizeUtm(body.utm_source);
  const utm_medium = sanitizeUtm(body.utm_medium);
  const utm_campaign = sanitizeUtm(body.utm_campaign);
  const utm_content = sanitizeUtm(body.utm_content);
  const utm_enabled = !!(utm_source && utm_medium && utm_campaign);

  const id = genId(8);
  const label = buildLabel({ team, project, deployment, deployment_detail });
  const record = {
    id,
    target_url: url,
    team,
    project,
    deployment,
    deployment_detail,
    utm: utm_enabled ? { source: utm_source, medium: utm_medium, campaign: utm_campaign, content: utm_content || null } : null,
    label,
    created_at: Date.now(),
  };
  await codesStore().setJSON(id, record);

  const origin = new URL(req.url).origin;
  return json({
    ...record,
    tracking_url: `${origin}/r/${id}`,
    analytics_url: `${origin}/analytics.html?id=${id}`,
    final_url: buildFinalUrl(record),
  });
};

export function buildFinalUrl(record) {
  if (!record.utm) return record.target_url;
  try {
    const u = new URL(record.target_url);
    u.searchParams.set('utm_source', record.utm.source);
    u.searchParams.set('utm_medium', record.utm.medium);
    u.searchParams.set('utm_campaign', record.utm.campaign);
    if (record.utm.content) u.searchParams.set('utm_content', record.utm.content);
    return u.toString();
  } catch {
    return record.target_url;
  }
}

export const config = { path: '/api/create' };
