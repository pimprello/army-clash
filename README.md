# Army Clash auto-uploader

Every run makes a brand-new 60-second **Red vs Blue Army Clash** Short (1080 × 1920, 60 fps, with sound) and posts it to your YouTube channel. GitHub runs it for you three times a day, so you don't have to press anything.

## One-time setup (about 15 minutes, easiest on a computer)

### 1. Google Cloud: allow uploads to your channel

1. Go to [console.cloud.google.com](https://console.cloud.google.com), signed in with the Google account that owns your YouTube channel, and create a new project (for example "Army Clash").
2. Open **APIs & Services → Library**, search for **YouTube Data API v3** and click **Enable**.
3. Open **Google Auth Platform** (also called the OAuth consent screen) and fill in the app name (for example "Army Clash Uploader") and your email.
   - **Audience:** choose **External**, and add your own email under **Test users**.
   - **Data Access:** click **Add or remove scopes**, add `https://www.googleapis.com/auth/youtube.upload`, then **Update** and **Save**.
   - Back on **Audience**, click **Publish app** so the status says **In production**. Leave it in Testing and the key stops working after 7 days.
4. Open **Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorised redirect URI: `https://developers.google.com/oauthplayground`
   - Click **Create**, then copy the **Client ID** and **Client secret**.

### 2. Make your upload key (refresh token)

1. Open [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right), tick **Use your own OAuth credentials**, and paste the Client ID and Client secret. Leave access type on **Offline**.
3. In **Step 1**, type `https://www.googleapis.com/auth/youtube.upload` into the box and click **Authorize APIs**.
4. Sign in with your channel's account. Google shows "Google hasn't verified this app" because the app is yours and unreviewed; click **Advanced**, then go to the app and allow access. If you have more than one channel, pick the Army Clash one.
5. In **Step 2**, click **Exchange authorization code for tokens** and copy the **Refresh token**.

### 3. Give the keys to GitHub

In this repository open **Settings → Secrets and variables → Actions → New repository secret** and add three secrets:

| Name | Value |
| --- | --- |
| `YT_CLIENT_ID` | the Client ID |
| `YT_CLIENT_SECRET` | the Client secret |
| `YT_REFRESH_TOKEN` | the refresh token |

### 4. Test it

Open the **Actions** tab → **Post Army Clash** → **Run workflow**. Pick `private` the first time if you want to check the video before anyone sees it. After about five minutes it appears on your channel.

From then on it posts automatically at 08:23, 13:23 and 19:23 UTC every day.

## Changing things

- **How often it posts:** edit the `cron` line in `.github/workflows/post-army-clash.yml`. For one a day at 18:00 UTC use `'0 18 * * *'`.
- **Titles and description:** edit the `meta` section at the end of `render.js`.
- **Try it on your computer:** `npm install`, then `node render.js` makes `out/army-clash.mp4` (needs ffmpeg). `DRY_RUN=1 node upload.js` shows what would be uploaded without posting it.

## Good to know

- Every posted video is added to `uploads.md` with its link. That small commit also keeps the schedule running, because GitHub pauses schedules in public repositories after 60 days without changes.
- The repository can stay public: your keys live in GitHub Secrets and are never shown in the code or the logs. Public repositories also get Actions minutes for free.
- YouTube allows up to 100 uploads a day through its API.
- If a run fails, the Actions tab shows why, and the video is kept there for 3 days.
- The font is Barlow Condensed (SIL Open Font License, included in `fonts/`).
