require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const tmi = require('tmi.js');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DEFAULT_TRANSLATION = process.env.DEFAULT_TRANSLATION || 'eng_kjv';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || `${APP_BASE_URL}/auth/twitch/callback`;

const fs = require('fs');

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'data.sqlite');
console.log(`Using SQLite database at: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  twitch_user_id TEXT UNIQUE NOT NULL,
  channel_login TEXT UNIQUE NOT NULL,
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  enabled INTEGER DEFAULT 1,
  preferred_translation TEXT DEFAULT 'eng_kjv'
);
`);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false }
}));

const BOOK_ALIASES = {
  GENESIS:'GEN', GEN:'GEN', EXODUS:'EXO', EXO:'EXO', LEVITICUS:'LEV', LEV:'LEV', NUMBERS:'NUM', NUM:'NUM',
  DEUTERONOMY:'DEU', DEUT:'DEU', JOSHUA:'JOS', JOSH:'JOS', JUDGES:'JDG', JUDG:'JDG', RUTH:'RUT',
  '1 SAMUEL':'1SA','1SAMUEL':'1SA','1 SAM':'1SA','1SAM':'1SA', '2 SAMUEL':'2SA','2SAMUEL':'2SA','2 SAM':'2SA','2SAM':'2SA',
  '1 KINGS':'1KI','1KINGS':'1KI','1 KGS':'1KI','1KGS':'1KI', '2 KINGS':'2KI','2KINGS':'2KI','2 KGS':'2KI','2KGS':'2KI',
  '1 CHRONICLES':'1CH','1CHRONICLES':'1CH','1 CHR':'1CH','1CHR':'1CH', '2 CHRONICLES':'2CH','2CHRONICLES':'2CH','2 CHR':'2CH','2CHR':'2CH',
  EZRA:'EZR', NEHEMIAH:'NEH', NEH:'NEH', ESTHER:'EST', EST:'EST', JOB:'JOB',
  PSALM:'PSA', PSALMS:'PSA', PSA:'PSA', PS:'PSA', PROVERBS:'PRO', PROV:'PRO', PRO:'PRO', ECCLESIASTES:'ECC', ECC:'ECC',
  'SONG OF SOLOMON':'SNG', 'SONG OF SONGS':'SNG', SONG:'SNG', SNG:'SNG', ISAIAH:'ISA', ISA:'ISA', JEREMIAH:'JER', JER:'JER',
  LAMENTATIONS:'LAM', LAM:'LAM', EZEKIEL:'EZK', EZEK:'EZK', EZK:'EZK', DANIEL:'DAN', DAN:'DAN', HOSEA:'HOS', HOS:'HOS',
  JOEL:'JOL', AMOS:'AMO', OBADIAH:'OBA', OBA:'OBA', JONAH:'JON', JON:'JON', MICAH:'MIC', MIC:'MIC',
  NAHUM:'NAM', NAH:'NAM', NAM:'NAM', HABAKKUK:'HAB', HAB:'HAB', ZEPHANIAH:'ZEP', ZEPH:'ZEP', ZEP:'ZEP', HAGGAI:'HAG',
  ZECHARIAH:'ZEC', ZECH:'ZEC', ZEC:'ZEC', MALACHI:'MAL', MATTHEW:'MAT', MATT:'MAT', MAT:'MAT', MARK:'MRK', MRK:'MRK',
  LUKE:'LUK', LUK:'LUK', JOHN:'JHN', JHN:'JHN', ACTS:'ACT', ROMANS:'ROM', ROM:'ROM',
  '1 CORINTHIANS':'1CO','1CORINTHIANS':'1CO','1 COR':'1CO','1COR':'1CO', '2 CORINTHIANS':'2CO','2CORINTHIANS':'2CO','2 COR':'2CO','2COR':'2CO',
  GALATIANS:'GAL', GAL:'GAL', EPHESIANS:'EPH', EPH:'EPH', PHILIPPIANS:'PHP', PHIL:'PHP', PHP:'PHP', COLOSSIANS:'COL', COL:'COL',
  '1 THESSALONIANS':'1TH','1THESSALONIANS':'1TH','1 THESS':'1TH','1THESS':'1TH', '2 THESSALONIANS':'2TH','2THESSALONIANS':'2TH','2 THESS':'2TH','2THESS':'2TH',
  '1 TIMOTHY':'1TI','1TIMOTHY':'1TI','1 TIM':'1TI','1TIM':'1TI', '2 TIMOTHY':'2TI','2TIMOTHY':'2TI','2 TIM':'2TI','2TIM':'2TI',
  TITUS:'TIT', PHILEMON:'PHM', PHLM:'PHM', PHM:'PHM', HEBREWS:'HEB', HEB:'HEB', JAMES:'JAS', JAS:'JAS',
  '1 PETER':'1PE','1PETER':'1PE','1 PET':'1PE','1PET':'1PE', '2 PETER':'2PE','2PETER':'2PE','2 PET':'2PE','2PET':'2PE',
  '1 JOHN':'1JN','1JOHN':'1JN', '2 JOHN':'2JN','2JOHN':'2JN', '3 JOHN':'3JN','3JOHN':'3JN', JUDE:'JUD', REVELATION:'REV', REV:'REV'
};

const TRANSLATION_ALIASES = {
  KJV:'eng_kjv', KJVA:'eng_kja', ASV:'eng_asv', ABT:'eng_abt', AAB:'AAB', BSB:'BSB', BBE:'eng_bbe', BOY:'eng_boy', BRE:'eng_bre',
  CPB:'eng_cpb', DBY:'eng_dby', DARBY:'eng_dby', DRA:'eng_dra', EMTV:'eng_emtv', JPS:'eng_jps', LEE:'eng_lee', LSV:'eng_lsv',
  LXU:'eng_lxu', LXX:'eng_lxx', MSB:'eng_msb', F35:'eng_f35', FBV:'eng_fbv', GLV:'eng_glw', GLW:'eng_glw', GNV:'eng_gnv',
  WEB:'ENGWEBP', WEBP:'ENGWEBP', WEBC:'eng_webc', WEBPB:'eng_webpb', WEBU:'eng_webu', WEU:'eng_weu', WMB:'eng_wmb', WMU:'eng_wmu',
  WYC2017:'eng_wyc2017', WYC2018:'eng_wyc2018', YLT:'eng_ylt', NET:'eng_net', NNA:'eng_nna', NOY:'eng_noy', OJB:'eng_ojb',
  OKE:'eng_oke', OUR:'eng_our', PEV:'eng_pev', RV5:'eng_rv5', T4T:'eng_t4t', TCE:'eng_tce', TNT:'eng_tnt', ULB:'eng_ulb',
  W88:'eng_w88', WBS:'eng_wbs', GHT:'GHT', NKJV:'NKJV'
};
const TRANSLATION_DISPLAY_LABELS = {
  eng_kjv:'KJV', eng_kja:'KJVA', eng_asv:'ASV', eng_abt:'ABT', AAB:'AAB', BSB:'BSB', eng_bbe:'BBE', eng_boy:'BOY', eng_bre:'BRE',
  eng_cpb:'CPB', eng_dby:'DARBY', eng_dra:'DRA', eng_emtv:'EMTV', eng_jps:'JPS', eng_lee:'LEE', eng_lsv:'LSV', eng_lxu:'LXU',
  eng_lxx:'LXX', eng_msb:'MSB', eng_f35:'F35', eng_fbv:'FBV', eng_glw:'GLV', eng_gnv:'GNV', eng_web:'WEB', ENGWEBP:'WEB',
  eng_webc:'WEBC', eng_webpb:'WEBPB', eng_webu:'WEBU', eng_weu:'WEU', eng_wmb:'WMB', eng_wmu:'WMU', eng_wyc2017:'WYC2017',
  eng_wyc2018:'WYC2018', eng_ylt:'YLT', eng_net:'NET', eng_nna:'NNA', eng_noy:'NOY', eng_ojb:'OJB', eng_oke:'OKE', eng_our:'OUR',
  eng_pev:'PEV', eng_rv5:'RV5', eng_t4t:'T4T', eng_tce:'TCE', eng_tnt:'TNT', eng_ulb:'ULB', eng_w88:'W88', eng_wbs:'WBS', GHT:'GHT', NKJV:'NKJV'
};

let englishTranslations = [];
const VERSE_REGEX = /^([1-3]?\s?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?:\s+([A-Za-z0-9_-]+))?$/i;

let nkjvHtmlCache = null;
const NKJV_SOURCE_URL = 'https://elcast.org/NKJV_Bible.html';
const NKJV_BOOK_TITLES = {
  GEN:'Genesis', EXO:'Exodus', LEV:'Leviticus', NUM:'Numbers', DEU:'Deuteronomy', JOS:'Joshua', JDG:'Judges', RUT:'Ruth',
  '1SA':'1 Samuel', '2SA':'2 Samuel', '1KI':'1 Kings', '2KI':'2 Kings', '1CH':'1 Chronicles', '2CH':'2 Chronicles',
  EZR:'Ezra', NEH:'Nehemiah', EST:'Esther', JOB:'Job', PSA:'Psalms', PRO:'Proverbs', ECC:'Ecclesiastes', SNG:'Song of Solomon',
  ISA:'Isaiah', JER:'Jeremiah', LAM:'Lamentations', EZK:'Ezekiel', DAN:'Daniel', HOS:'Hosea', JOL:'Joel', AMO:'Amos', OBA:'Obadiah',
  JON:'Jonah', MIC:'Micah', NAM:'Nahum', HAB:'Habakkuk', ZEP:'Zephaniah', HAG:'Haggai', ZEC:'Zechariah', MAL:'Malachi',
  MAT:'Matthew', MRK:'Mark', LUK:'Luke', JHN:'John', ACT:'Acts', ROM:'Romans', '1CO':'1 Corinthians', '2CO':'2 Corinthians',
  GAL:'Galatians', EPH:'Ephesians', PHP:'Philippians', COL:'Colossians', '1TH':'1 Thessalonians', '2TH':'2 Thessalonians',
  '1TI':'1 Timothy', '2TI':'2 Timothy', TIT:'Titus', PHM:'Philemon', HEB:'Hebrews', JAS:'James', '1PE':'1 Peter', '2PE':'2 Peter',
  '1JN':'1 John', '2JN':'2 John', '3JN':'3 John', JUD:'Jude', REV:'Revelation'
};
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
async function getNkjvHtml() {
  if (nkjvHtmlCache) return nkjvHtmlCache;
  nkjvHtmlCache = await fetchText(NKJV_SOURCE_URL);
  return nkjvHtmlCache;
}
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function stripHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function extractChapterSliceFromHtml(html, bookName, chapter) {
  const bookPattern = escapeRegExp(bookName);
  const chapterPattern = new RegExp(`${bookPattern}\s+${chapter}(?:\b|\s*</[^>]+>)`, 'i');
  const nextChapterPattern = new RegExp(`${bookPattern}\s+${Number(chapter) + 1}(?:\b|\s*</[^>]+>)`, 'i');
  const startMatch = chapterPattern.exec(html);
  if (!startMatch) return null;
  const start = startMatch.index;
  const rest = html.slice(start + startMatch[0].length);
  const nextMatch = nextChapterPattern.exec(rest);
  const end = nextMatch ? start + startMatch[0].length + nextMatch.index : start + startMatch[0].length + rest.length;
  return html.slice(start, end);
}
function extractVersesFromChapterText(chapterText) {
  const matches = [...chapterText.matchAll(/(?:^|\s)(\d{1,3})\s+/g)];
  const verses = [];
  for (let i = 0; i < matches.length; i++) {
    const verseNo = Number(matches[i][1]);
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : chapterText.length;
    const text = chapterText.slice(start, end).replace(/\s+/g, ' ').trim();
    verses.push({ number: verseNo, text });
  }
  return verses.filter(v => v.text);
}
async function fetchNkjvVerse(bookId, chapter, verseStart, verseEnd) {
  const html = await getNkjvHtml();
  const bookName = NKJV_BOOK_TITLES[bookId];
  if (!bookName) throw new Error(`Unsupported NKJV book: ${bookId}`);
  const chapterSlice = extractChapterSliceFromHtml(html, bookName, chapter);
  if (!chapterSlice) throw new Error('NKJV chapter not found');
  const chapterText = stripHtml(chapterSlice);
  const verses = extractVersesFromChapterText(chapterText);
  const selected = verses.filter(v => v.number >= verseStart && v.number <= (verseEnd || verseStart));
  if (!selected.length) throw new Error('NKJV verse not found');
  return {
    bookName,
    text: selected.map(v => `${v.number}. ${v.text}`).join(' ')
  };
}

function truncateMessage(text, maxLen = 490) {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1).trimEnd() + '…';
}
function normalizeBookId(bookRaw) {
  const key = bookRaw.trim().replace(/\s+/g, ' ').toUpperCase();
  return BOOK_ALIASES[key] || null;
}
function normalizeTranslationId(versionRaw, fallback = DEFAULT_TRANSLATION) {
  if (!versionRaw) return fallback;
  const upper = versionRaw.trim().toUpperCase();
  return TRANSLATION_ALIASES[upper] || versionRaw.trim();
}
function getTranslationDisplayLabel(translationId, versionRaw) {
  if (versionRaw && TRANSLATION_ALIASES[versionRaw.trim().toUpperCase()] === translationId) return versionRaw.trim().toUpperCase();
  return TRANSLATION_DISPLAY_LABELS[translationId] || translationId;
}
function isKnownTranslationId(translationId) {
  return englishTranslations.some(t => t.id.toLowerCase() === String(translationId).toLowerCase());
}
function flattenVerseContent(items) {
  return items.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item.text === 'string') return item.text;
    if (item && item.heading) return item.heading;
    if (item && item.lineBreak) return ' ';
    return '';
  }).join(' ').replace(/\s+/g, ' ').trim();
}
async function loadEnglishTranslations() {
  const res = await fetch('https://bible.helloao.org/api/available_translations.json');
  const data = await res.json();
  englishTranslations = (data.translations || []).filter(t => t.language === 'eng');
  console.log(`Loaded ${englishTranslations.length} English translations from HelloAO.`);
}
async function fetchChapter(translationId, bookId, chapter) {
  const url = `https://bible.helloao.org/api/${encodeURIComponent(translationId)}/${bookId}/${chapter}.json`;
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`Expected JSON but got ${contentType || 'unknown'}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

const botClient = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN
  },
  channels: []
});

async function joinEnabledChannels() {
  const rows = db.prepare('SELECT channel_login FROM channels WHERE enabled = 1').all();
  for (const row of rows) {
    try { await botClient.join(row.channel_login); console.log(`Joined #${row.channel_login}`); }
    catch (e) { console.error(`Failed to join #${row.channel_login}:`, e.message); }
  }
}

botClient.on('message', async (channel, tags, message, self) => {
  if (self) return;
  const trimmed = message.trim();
  const match = trimmed.match(VERSE_REGEX);
  if (!match) return;

  const channelLogin = channel.replace(/^#/, '').toLowerCase();
  const settings = db.prepare('SELECT preferred_translation FROM channels WHERE channel_login = ?').get(channelLogin);
  const channelDefault = settings?.preferred_translation || DEFAULT_TRANSLATION;

  const [, bookRaw, chapterRaw, verseStartRaw, verseEndRaw, versionRaw] = match;
  const bookId = normalizeBookId(bookRaw);
  if (!bookId) return;

  const translationId = normalizeTranslationId(versionRaw, channelDefault);
  if (versionRaw && translationId !== 'NKJV' && englishTranslations.length && !isKnownTranslationId(translationId)) {
    await botClient.say(channel, truncateMessage(`@${tags.username} ❌ Unknown translation: ${versionRaw}`));
    return;
  }

  try {
    const verseStart = verseStartRaw ? Number(verseStartRaw) : null;
    const verseEnd = verseEndRaw ? Number(verseEndRaw) : null;

    if (translationId === 'NKJV') {
      if (!verseStart) {
        await botClient.say(channel, `@${tags.username} ❌ Please include a verse number for NKJV.`);
        return;
      }
      const nkjv = await fetchNkjvVerse(bookId, Number(chapterRaw), verseStart, verseEnd);
      const reference = `${nkjv.bookName} ${chapterRaw}:${verseStart}${verseEnd ? '-' + verseEnd : ''}`;
      await botClient.say(channel, truncateMessage(`📖 ${reference} (NKJV) — ${nkjv.text}`));
      return;
    }

    const data = await fetchChapter(translationId, bookId, Number(chapterRaw));
    const verses = (data?.chapter?.content || []).filter(item => item.type === 'verse');
    const selected = verseStart === null ? verses : verses.filter(v => v.number >= verseStart && v.number <= (verseEnd || verseStart));
    if (!selected.length) {
      await botClient.say(channel, `@${tags.username} ❌ Verse not found.`);
      return;
    }
    const verseText = selected.map(v => `${v.number}. ${flattenVerseContent(v.content || [])}`).join(' ').replace(/\s+/g, ' ').trim();
    const reference = `${data.book?.commonName || bookRaw} ${chapterRaw}${verseStart ? ':' + verseStart + (verseEnd ? '-' + verseEnd : '') : ''}`;
    const displayLabel = getTranslationDisplayLabel(translationId, versionRaw);
    await botClient.say(channel, truncateMessage(`📖 ${reference} (${displayLabel}) — ${verseText}`));
  } catch (error) {
    console.error('Verse fetch error:', error.message);
    await botClient.say(channel, truncateMessage(`@${tags.username} ⚠️ Could not fetch that verse or translation.`));
  }
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}
function twitchAuthorizeUrl(state) {
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', '');
  url.searchParams.set('state', state);
  return url.toString();
}
async function exchangeCodeForToken(code) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITCH_REDIRECT_URI
    })
  });
  return await res.json();
}
async function getTwitchUser(accessToken) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const data = await res.json();
  return data?.data?.[0] || null;
}

app.get('/', (req, res) => {
  res.render('home', { user: req.session.user || null, appBaseUrl: APP_BASE_URL });
});
app.get('/auth/twitch', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(twitchAuthorizeUrl(state));
});
app.get('/auth/twitch/callback', async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.oauthState) return res.status(400).send('Invalid OAuth state.');
    const tokenData = await exchangeCodeForToken(req.query.code);
    if (!tokenData.access_token) return res.status(400).send('Failed to get access token from Twitch.');
    const twitchUser = await getTwitchUser(tokenData.access_token);
    if (!twitchUser) return res.status(400).send('Failed to load Twitch user profile.');

    db.prepare(`
      INSERT INTO channels (twitch_user_id, channel_login, display_name, access_token, refresh_token, enabled, preferred_translation, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(twitch_user_id) DO UPDATE SET
        channel_login = excluded.channel_login,
        display_name = excluded.display_name,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        enabled = 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      twitchUser.id,
      twitchUser.login.toLowerCase(),
      twitchUser.display_name,
      tokenData.access_token,
      tokenData.refresh_token || null,
      DEFAULT_TRANSLATION
    );

    req.session.user = {
      id: twitchUser.id,
      login: twitchUser.login.toLowerCase(),
      display_name: twitchUser.display_name,
      profile_image_url: twitchUser.profile_image_url
    };

    try { await botClient.join(twitchUser.login.toLowerCase()); } catch (e) {}
    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth setup failed. Check server logs.');
  }
});
app.get('/dashboard', requireLogin, (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE twitch_user_id = ?').get(req.session.user.id);
  res.render('dashboard', {
    user: req.session.user,
    channel,
    appBaseUrl: APP_BASE_URL,
    TRANSLATION_DISPLAY_LABELS
  });
});
app.post('/dashboard/settings', requireLogin, (req, res) => {
  const preferred = normalizeTranslationId(req.body.preferred_translation || DEFAULT_TRANSLATION, DEFAULT_TRANSLATION);
  db.prepare('UPDATE channels SET preferred_translation = ?, updated_at = CURRENT_TIMESTAMP WHERE twitch_user_id = ?').run(preferred, req.session.user.id);
  res.redirect('/dashboard');
});
app.post('/dashboard/toggle', requireLogin, async (req, res) => {
  const channel = db.prepare('SELECT * FROM channels WHERE twitch_user_id = ?').get(req.session.user.id);
  const newEnabled = channel.enabled ? 0 : 1;
  db.prepare('UPDATE channels SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE twitch_user_id = ?').run(newEnabled, req.session.user.id);
  try {
    if (newEnabled) await botClient.join(channel.channel_login);
    else await botClient.part(channel.channel_login);
  } catch (e) {}
  res.redirect('/dashboard');
});
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
app.get('/health', (req, res) => res.json({ ok: true }));

(async () => {
  await loadEnglishTranslations();
  await botClient.connect();
  await joinEnabledChannels();
  app.listen(PORT, () => {
    console.log(`Public Twitch Bible bot running on ${APP_BASE_URL}`);
  });
})();
