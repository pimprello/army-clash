// Lists (and, if asked, deletes) Army Clash videos posted before today with fewer than MIN_VIEWS views.
// Run from GitHub Actions: "Delete low-view videos" → Run workflow (see README / RULES.md, "Deleting low-view videos").
//   MODE=list    (default) only lists the matching videos. Needs YT_API_KEY, or the delete sign-in below.
//   MODE=delete  deletes them. Needs YT_CLIENT_ID, YT_CLIENT_SECRET and YT_DELETE_REFRESH_TOKEN
//                (a refresh token made with the full "https://www.googleapis.com/auth/youtube" scope;
//                 the upload token can't delete).
//   MIN_VIEWS (100), MAX_DELETE (50 per run: each delete costs 50 units of the daily YouTube quota the uploads also use),
//   CHANNEL_ID (the Army Clash channel).
// Videos posted today (UTC) are never touched. Nothing in the repo changes (uploads.md keeps its rows).
'use strict';
const fs = require('fs');

const MODE = process.env.MODE === 'delete' ? 'delete' : 'list';
const MIN_VIEWS = Number(process.env.MIN_VIEWS || 100);
const MAX_DELETE = Math.max(0, Number(process.env.MAX_DELETE || 50));
const CHANNEL_ID = process.env.CHANNEL_ID || 'UCfWpudL-JOSv3V5t_NLDa3A';
const UPLOADS = 'UU' + CHANNEL_ID.slice(2);
const API = 'https://www.googleapis.com/youtube/v3/';

const summary = [];
const say = (line = '') => { console.log(line); summary.push(line); };

async function signIn() {
  if (!process.env.YT_DELETE_REFRESH_TOKEN) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.YT_CLIENT_ID || '', client_secret: process.env.YT_CLIENT_SECRET || '',
      refresh_token: process.env.YT_DELETE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google sign-in with YT_DELETE_REFRESH_TOKEN failed (${r.status} ${j.error || ''}). Make a new refresh token with the "youtube" scope.`);
  return j.access_token;
}

async function call(path, params, { method = 'GET', token, key } = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  if (!token && key) u.searchParams.set('key', key);
  const r = await fetch(u, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube refused ${method} ${path} (${r.status}): ${j.error && j.error.message}`);
  return j;
}

(async () => {
  const token = await signIn();
  const key = process.env.YT_API_KEY;
  if (MODE === 'delete' && !token) throw new Error('MODE=delete needs a YT_DELETE_REFRESH_TOKEN secret (a refresh token with the "youtube" scope).');
  if (!token && !key) throw new Error('Needs a YT_API_KEY secret (to list) or YT_DELETE_REFRESH_TOKEN (to list and delete).');
  const auth = { token, key };

  // every upload on the channel
  const ids = [];
  let page;
  do {
    const j = await call('playlistItems', { part: 'contentDetails', playlistId: UPLOADS, maxResults: 50, pageToken: page }, auth);
    for (const it of j.items || []) ids.push(it.contentDetails.videoId);
    page = j.nextPageToken;
  } while (page);
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await call('videos', { part: 'statistics,snippet', id: ids.slice(i, i + 50).join(',') }, auth);
    videos.push(...(j.items || []));
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const matches = videos
    .map(v => ({ id: v.id, title: v.snippet.title, date: v.snippet.publishedAt, views: Number((v.statistics || {}).viewCount || 0) }))
    .filter(v => new Date(v.date) < today && v.views < MIN_VIEWS)
    .sort((a, b) => a.date.localeCompare(b.date));

  say(`## ${MODE === 'delete' ? 'Deleting' : 'Listing'} videos posted before ${today.toISOString().slice(0, 10)} with fewer than ${MIN_VIEWS} views`);
  say('');
  say(`${matches.length} of ${videos.length} videos on the channel match.${MODE === 'delete' && matches.length > MAX_DELETE ? ` This run deletes the oldest ${MAX_DELETE}; run it again for the rest.` : ''}`);
  say('');
  say('| Posted (UTC) | Views | Title | Link |');
  say('| --- | --- | --- | --- |');
  for (const m of matches) say(`| ${m.date.replace('T', ' ').slice(0, 16)} | ${m.views} | ${m.title.replace(/\|/g, '\\|')} | https://youtube.com/shorts/${m.id} |`);
  say('');

  if (MODE === 'list') {
    say('Nothing was deleted. To delete these, run the workflow again with mode "delete".');
  } else {
    let done = 0;
    for (const m of matches.slice(0, MAX_DELETE)) {
      if (new Date(m.date) >= today) continue; // never today's videos
      await call('videos', { id: m.id }, { method: 'DELETE', token });
      done++;
      console.log(`deleted ${m.id}  ${m.title}`);
    }
    say(`Deleted ${done} video${done === 1 ? '' : 's'}.`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
})().catch(err => {
  console.error(err.message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Failed:** ${err.message}\n`);
  console.log(`::error::${err.message}`);
  process.exit(1);
});
