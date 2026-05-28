# Public Twitch Bible Bot

A multi-channel public Twitch Bible bot with a web UI. Streamers can connect their Twitch account, enable the bot for their channel, and set a default Bible translation.

## Features

- Public landing page
- Twitch OAuth login
- Per-channel dashboard
- Enable/disable bot for your channel
- Default translation setting per channel
- Multi-channel Twitch chat bot using one central bot account
- Verse lookup via HelloAO Free Use Bible API
- SQLite stored on a Railway volume path for persistence

## Stack

- Node.js + Express
- EJS templates
- better-sqlite3 for simple persistence
- tmi.js for Twitch chat
- Railway-ready deployment

## Important Twitch setup

Create a Twitch developer application and set:

- OAuth Redirect URL: `https://your-app.up.railway.app/auth/twitch/callback`
- Save `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`

The bot account itself still needs a valid Twitch chat OAuth token in `TWITCH_OAUTH_TOKEN`.

## Railway persistence setup

This app stores SQLite in:

- `process.env.RAILWAY_VOLUME_MOUNT_PATH`, if available, or
- local `./data/data.sqlite` during development

### On Railway

1. Create a **Volume** for the service
2. Mount it at **`/app/data`**
3. The app will automatically use that path and persist `data.sqlite`

## Environment

Copy `.env.example` to `.env` and fill in the values.

## Run locally

```bash
npm install
npm start
```

## Deploy to Railway

1. Push to GitHub
2. Create a Railway project from the repo
3. Add the environment variables from `.env.example`
4. Update `APP_BASE_URL` and `TWITCH_REDIRECT_URI` to your Railway domain
5. Create and mount a volume at `/app/data`
6. Redeploy

## Node version note

This project pins **Node 22** because native SQLite builds can fail on newer runtimes without matching prebuilt binaries.
