# Notes for Claude

This repo auto-posts 60-second Army Clash Shorts to YouTube for Rellz. `.github/workflows/post-army-clash.yml` renders with `render.js` + `engine.js` and uploads with `upload.js`. Each run queues the next one 15 minutes after it started (96 a day, evenly spaced, under YouTube's 100-upload daily limit), because GitHub's cron didn't fire reliably. If an upload fails, the reason is shown as a GitHub annotation (readable via the check-runs annotations API).

When Rellz asks to change future videos ("add a unit", "use these colours", "make X rarer"):
1. Prefer editing `rules.json`. Add a new rule there if the request is a dial he'll likely want to turn again, then document it in `RULES.md`.
2. For new behaviour, change `engine.js` (simulation and drawing) or `render.js` (rules, titles, tags). Keep old seeds deterministic when a new option is off.
3. Test before pushing: `npm ci`, then render one frame or a full video with `SEED=123 node render.js` (needs ffmpeg), and check balance across many seeds for gameplay changes.
4. Don't send Rellz preview videos (he asked not to; they take too long). Test with still frames instead.
5. Commit and push to `main`. The next run checks out `main`, so the change applies from the next video. Say plainly that already-posted videos don't change.

Line-ups, formations and eras (medieval/modern) all rotate deterministically from the number of rows in `uploads.md`; nothing about the troop mix is random per video except colours.

Limits to remember: YouTube allows 100 API uploads a day per project, and the repo must stay active (each upload commits to `uploads.md`).
