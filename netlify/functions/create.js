import { db, genId, json, shapeCode, buildFinalUrl, shortenUrl } from './_lib.js';

const ALLOWED_TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const ALLOWED_DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

function buildLabel({ team, project, deployment, deployment_detail }) {
  const dep = deployment_detail ? `${deployment} (${deployment_detail})` : deployment;
  return `${team} — ${project} — ${dep}`;
}

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

  const utm_source = sanitizeUtm(body.utm_source);
  const utm_medium = sanitizeUtm(body.utm_medium);
  const utm_campaign = sanitizeUtm(body.utm_campaign);
  const utm_content = sanitizeUtm(body.utm_content);
  const utm_enabled = !!(utm_source && utm_medium && utm_campaign);

  const id = genId(8);
  const origin = new URL(req.url).origin;
  const tracked_url = `${origin}/r/${id}`;
  const label = buildLabel({ team, project, deployment, deployment_detail });

  // Shorten the tracked URL via Bit.ly (if token set) or TinyURL (no auth).
  // Runs in parallel-ish but we await it before insert so the row has the short URL.
  const short_url = await shortenUrl(tracked_url);

  const row = {
    id,
    target_url: url,
    team,
    project,
    deployment,
    deployment_detail,
    utm_source: utm_enabled ? utm_source : null,
    utm_medium: utm_enabled ? utm_medium : null,
    utm_campaign: utm_enabled ? utm_campaign : null,
    utm_content: utm_enabled ? (utm_content || null) : null,
    tracked_url,
    short_url,
    label,
  };

  const { data, error } = await db().from('codes').insert(row).select().single();
  if (error) return json({ error: error.message }, { status: 500 });

  const shaped = shapeCode(data);
  return json({
    ...shaped,
    tracking_url: tracked_url,                       // legacy alias for older clients
    analytics_url: `${origin}/analytics.html?id=${id}`,
    final_url: buildFinalUrl({ target_url: shaped.target_url, utm: shaped.utm }),
  });
};

export const config = { path: '/api/create' };
