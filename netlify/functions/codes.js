import { json, listAllCodes, listAllScans } from './_lib.js';

export default async () => {
  const codes = await listAllCodes();
  const enriched = await Promise.all(
    codes.map(async (c) => {
      const scans = await listAllScans(c.id);
      const lastScan = scans.reduce((m, s) => Math.max(m, s.scanned_at || 0), 0);
      return { ...c, scan_count: scans.length, last_scan: lastScan || null };
    })
  );
  enriched.sort((a, b) => b.created_at - a.created_at);
  return json(enriched);
};

export const config = { path: '/api/codes' };
