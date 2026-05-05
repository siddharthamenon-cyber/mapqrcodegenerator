import { db, json, shapeCode } from './_lib.js';

export default async () => {
  const { data, error } = await db()
    .from('codes_with_stats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data.map(shapeCode));
};

export const config = { path: '/api/codes' };
