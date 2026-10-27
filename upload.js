// Uploads out/army-clash.mp4 to YouTube with the title from out/meta.json.
// Needs three secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (see README).
// Optional: PRIVACY = public | unlisted | private (default public). DRY_RUN=1 prints instead of uploading.
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
const file = path.join(OUT, 'army-clash.mp4');
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
const privacy = ['public', 'unlisted', 'private'].includes(process.env.PRIVACY) ? process.env.PRIVACY : 'public';

const body = {
  snippet: { title: meta.title.slice(0, 100), description: meta.description, tags: meta.tags, categoryId: '20' },
  status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
};

async function accessToken() {
  const need = ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'].filter(k => !process.env[k]);
  if (need.length) throw new Error(`Missing GitHub secret(s): ${need.join(', ')}. Add them under Settings → Secrets and variables → Actions.`);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const hint = j.error === 'invalid_grant' ? ' The refresh token was refused: make a new one (README step 3) and check the Google app is set to "In production".' : '';
    throw new Error(`Google sign-in failed (${r.status} ${j.error || ''}).${hint}`);
  }
  return j.access_token;
}

async function upload() {
  const size = fs.statSync(file).size;
  const token = await accessToken();
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(body),
  });
  if (!start.ok) throw new Error(`YouTube refused the upload (${start.status}): ${await start.text()}`);
  const target = start.headers.get('location');
  const put = await fetch(target, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
    body: fs.readFileSync(file),
  });
  const j = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`Upload failed (${put.status}): ${JSON.stringify(j)}`);
  return j.id;
}

async function main() {
  if (process.env.DRY_RUN) {
    console.log('Dry run, nothing uploaded. Would send:', JSON.stringify(body, null, 2), `\nfile: ${file} (${fs.statSync(file).size} bytes)`);
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const id = await upload();
      const url = `https://youtube.com/shorts/${id}`;
      fs.writeFileSync(path.join(OUT, 'uploaded.json'), JSON.stringify({ id, url, title: body.snippet.title, winner: meta.winner, privacy, date: new Date().toISOString().slice(0, 16).replace('T', ' ') }, null, 2));
      console.log(`Uploaded "${body.snippet.title}" as ${privacy}: ${url}`);
      return;
    } catch (e) {
      const retry = attempt < 3 && /\((5\d\d)\b/.test(e.message);
      console.error(`Attempt ${attempt}: ${e.message}`);
      if (!retry) throw e;
      await new Promise(r => setTimeout(r, 15000 * attempt));
    }
  }
}

main().catch(() => process.exit(1));
