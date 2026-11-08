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
  // (YouTube refuses tags over 500 characters in all; keep as many as fit, in order)
  snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 4900), tags: (meta.tags || []).reduce((a, t) => (a.join(',').length + t.length + 3 <= 480 ? a.concat(t) : a), []), categoryId: '20' },
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
  return { id: j.id, token };
}

// The thumbnail (out/thumb.jpg, rules.thumbnail). A refusal is a warning, never a failed run: the video is already up.
async function setThumb(id, token, quiet) {
  const pic = path.join(OUT, 'thumb.jpg');
  if (!fs.existsSync(pic)) return 'none';
  try {
    const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(id)}&uploadType=media`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: fs.readFileSync(pic),
    });
    if (r.ok) { if (!quiet) console.log('Thumbnail set.'); return 'set'; }
    const j = await r.json().catch(() => ({}));
    const why = (j.error && (j.error.message || j.error.status)) || r.statusText;
    console.log(`::warning title=Thumbnail not set::YouTube refused the custom thumbnail (${r.status}: ${String(why).replace(/\s+/g, ' ').slice(0, 300)}). The video is up with YouTube's own thumbnail. Custom thumbnails need a verified channel (phone verification in YouTube Studio); on Shorts YouTube is rolling them out to Partner Program channels first.`);
    return `refused ${r.status}`;
  } catch (e) {
    console.log(`::warning title=Thumbnail not set::${String(e.message).slice(0, 300)}`);
    return 'error';
  }
}

// A thumbnail set straight after the upload, while YouTube is still processing the video, is accepted ("Thumbnail set.") but
// can be replaced by a frame from the video when processing finishes (Rellz, 2026-11-08: "they generate it but when i check my
// uploads it doesn't actually have the thumbnail on"). So it's set again once processing is done. (If the channel doesn't have
// custom Shorts thumbnails yet, rolling out since July 2026, YouTube accepts the call and ignores it: nothing here can change that.)
// The upload token (youtube.upload) can't read the video back, so "done" is when YouTube has made the video's own
// thumbnail picture (public, no sign-in needed), plus a margin; a token with more access is asked directly.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function processed(id, token, maxMs) {
  const t0 = Date.now();
  let canAsk = true;
  while (Date.now() - t0 < maxMs) {
    if (canAsk) {
      try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=processingDetails&id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) canAsk = false;
        else {
          const j = await r.json(), st = j.items && j.items[0] && j.items[0].processingDetails && j.items[0].processingDetails.processingStatus;
          if (st === 'succeeded') return 'processed';
          if (st === 'failed' || st === 'terminated') return st;
        }
      } catch (e) { canAsk = false; }
    }
    if (!canAsk) {
      try { const r = await fetch(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`); if (r.ok) return 'own thumbnail made'; } catch (e) { /* try again */ }
    }
    await sleep(20000);
  }
  return 'still processing';
}
async function thumbAfterProcessing(id, token) {
  if (!fs.existsSync(path.join(OUT, 'thumb.jpg'))) return;
  const t0 = Date.now(), how = await processed(id, token, 9 * 60000);
  console.log(`YouTube processing: ${how} after ${Math.round((Date.now() - t0) / 1000)} s.`);
  // set it twice more, a little apart (each costs 50 of the day's 10,000 API units)
  await sleep(45000);
  let r = await setThumb(id, token, true);
  await sleep(90000);
  if (r === 'set') r = await setThumb(id, token, true);
  console.log(r === 'set' ? 'Thumbnail set again after processing.' : `Thumbnail after processing: ${r}.`);
}

async function main() {
  if (process.env.DRY_RUN) {
    const pic = path.join(OUT, 'thumb.jpg');
    console.log('Dry run, nothing uploaded. Would send:', JSON.stringify(body, null, 2), `\nfile: ${file} (${fs.statSync(file).size} bytes)`, fs.existsSync(pic) ? `\nthumbnail: ${pic} (${fs.statSync(pic).size} bytes)` : '\nno thumbnail');
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const { id, token } = await upload();
      const url = `https://youtube.com/shorts/${id}`;
      fs.writeFileSync(path.join(OUT, 'uploaded.json'), JSON.stringify({ id, url, title: body.snippet.title, winner: meta.winner, privacy, date: new Date().toISOString().slice(0, 16).replace('T', ' ') }, null, 2));
      console.log(`Uploaded "${body.snippet.title}" as ${privacy}: ${url}`);
      const first = await setThumb(id, token).catch(() => 'error');
      if (first === 'set') await thumbAfterProcessing(id, token).catch(e => console.log(`::warning title=Thumbnail::${String(e.message).slice(0, 300)}`));
      return;
    } catch (e) {
      const retry = attempt < 3 && /\((5\d\d)\b/.test(e.message);
      console.error(`Attempt ${attempt}: ${e.message}`);
      // also show the reason as a GitHub annotation, so it can be read without opening the logs
      if (!retry) { console.log(`::error title=YouTube upload failed::${e.message.replace(/\s+/g, ' ').slice(0, 600)}`); throw e; }
      await new Promise(r => setTimeout(r, 15000 * attempt));
    }
  }
}

main().catch(() => process.exit(1));
