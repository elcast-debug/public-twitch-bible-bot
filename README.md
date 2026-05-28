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
5. Redeploy

## Notes

- This starter stores data in SQLite for simplicity. For serious production use, switch to Postgres.
- The Twitch OAuth login is used to identify the streamer and save their channel.
- The bot joins enabled channels from the database on startup.
