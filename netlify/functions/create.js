import { codesStore, genId, json } from './_lib.js';

const ALLOWED_TEAMS = ['Admin', 'Conservation', 'Design', 'Development', 'Exhibition', 'Inclusion', 'Marcomms', 'Programmes', 'Tech'];
const ALLOWED_DEPLOYMENTS = ['Website', 'Gallery', 'Physical location outside museum', 'Email / Newsletter', 'Print collateral', 'Social media', 'Other'];

function buildLabel({ team, project, deployment, deployment_detail }) {
  const dep = deployment_detail ? `${deployment} (${deployment_detail})` : deployment;
  return `${team} — ${project} — ${dep}`;
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

  const id = genId(8);
  const label = buildLabel({ team, project, deployment, deployment_detail });
  const record = {
    id,
    target_url: url,
    team,
    project,
    deployment,
    deployment_detail,
    label,
    created_at: Date.now(),
  };
  await codesStore().setJSON(id, record);

  const origin = new URL(req.url).origin;
  return json({
    ...record,
    tracking_url: `${origin}/r/${id}`,
    analytics_url: `${origin}/analytics.html?id=${id}`,
  });
};

export const config = { path: '/api/create' };
