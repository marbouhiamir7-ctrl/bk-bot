const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TOKEN;

// ====== Security Headers ======

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('X-Request-ID', crypto.randomBytes(8).toString('hex'));
    res.removeHeader('X-Powered-By');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (req.path.endsWith('.html') || !req.path.includes('.')) {
        res.setHeader('Surrogate-Control', 'no-store');
    }
    if (req.path.includes('..') || req.path.includes('%2e%2e') || req.path.includes('%252e')) {
        return res.status(400).json({ error: 'Invalid path' });
    }
    next();
});

// ====== Rate Limiting ======

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests, try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts, try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { error: 'API rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false
});

const userLookupLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 8,
    message: { error: 'User lookup rate limit exceeded. Slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

const restoreLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many restore operations. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use((req, res, next) => {
    if (req.path.startsWith('/admin/')) return next();
    generalLimiter(req, res, next);
});

// ====== Body Parser (restrict size) ======

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ====== Input Sanitization ======

function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[c]));
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') clean[k] = sanitize(v);
        else if (typeof v === 'object' && !Array.isArray(v)) clean[k] = sanitizeObject(v);
        else if (Array.isArray(v)) clean[k] = v.map(i => typeof i === 'string' ? sanitize(i) : i);
        else clean[k] = v;
    }
    return clean;
}

// ====== CSRF Token ======

app.use((req, res, next) => {
    if (req.method === 'GET') {
        let csrfToken = req.cookies.bk_csrf;
        if (!csrfToken) {
            csrfToken = crypto.randomBytes(32).toString('hex');
            res.cookie('bk_csrf', csrfToken, { maxAge: 3600000, httpOnly: false, sameSite: 'strict' });
        }
        res.locals.csrfToken = csrfToken;
    }
    next();
});

function csrfCheck(req, res, next) {
    const cookieToken = req.cookies.bk_csrf;
    const headerToken = req.headers['x-csrf-token'];
    if (req.method !== 'GET' && (!cookieToken || !headerToken || headerToken !== cookieToken)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    next();
}

// ====== Static Files (no sensitive files) ======

app.use(express.static(path.join(__dirname, 'website'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
}));

// Block access to sensitive files
app.use((req, res, next) => {
    const blocked = ['.env', 'db.js', 'index.js', 'server.js', 'check.js', 'package.json', 'config.json', 'node_modules', '.git'];
    if (blocked.some(b => req.path.includes(b))) {
        return res.status(404).json({ error: 'Not found' });
    }
    if (req.path.startsWith('/admin/api/') && !req.path.match(/^\/admin\/api\/(login|check|logout|overview|servers|server\/|activity|honeypot|audit|security|bot|global-data)/)) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

// ====== HTTP Helpers ======

async function discordAPI(apiPath, options = {}) {
    const { method = 'GET', headers = {}, body } = options;
    try {
        const res = await fetch(`https://discord.com/api${apiPath}`, {
            method,
            headers: { 'User-Agent': 'BK-BOT-Dashboard/1.0', ...headers },
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch(e) { return { _raw: text.substring(0,200), _status: res.status }; }
    } catch(e) {
        console.error('[Fetch Error]', apiPath, e.message);
        return { _error: e.message };
    }
}

function isOk(res) {
    return res && !res._error && !res._status && !res.code && !res.message;
}

function botAPI(apiPath) {
    return discordAPI(apiPath, {
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' }
    });
}

function userAPI(apiPath, accessToken) {
    return discordAPI(apiPath, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
}

// ====== Auth Middleware ======

function authMiddleware(req, res, next) {
    const token = req.cookies.bk_session;
    const session = db.getSession(token);
    if (!session) return res.status(401).json({ logged_in: false });
    req.user = session.user;
    req.guilds = session.guilds;
    req.sessionToken = token;
    next();
}

function guildAuth(req, res, next) {
    const guildId = req.params.id?.replace(/[^0-9]/g, '');
    if (!guildId || !req.guilds || !req.guilds.some(g => g.id === guildId)) {
        return res.status(403).json({ error: 'You do not have access to this server' });
    }
    const g = req.guilds.find(g => g.id === guildId);
    if (g && typeof g.permissions === 'string' && (parseInt(g.permissions) & 0x20) !== 0x20 && !g.owner) {
        return res.status(403).json({ error: 'Administrator permission required' });
    }
    next();
}

// ====== Auth Routes ======

app.get('/login', authLimiter, (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify+guilds`;
    console.log('[Login] Redirecting to Discord');
    res.redirect(url);
});

app.get('/callback', authLimiter, (req, res) => {
    const { code, error } = req.query;
    console.log('[OAuth] Callback. code:', !!code, 'error:', error);
    if (error) return res.redirect(`/login.html?error=${encodeURIComponent(error)}`);
    if (!code) return res.redirect('/login.html?error=no_code');

    const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    
    discordAPI('/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    }).then(tokenData => {
        console.log('[OAuth] Token:', tokenData.access_token ? 'OK' : (tokenData.error || 'no_token'));
        if (!tokenData.access_token) return res.redirect('/login.html?error=token_failed');

        return Promise.all([
            userAPI('/users/@me', tokenData.access_token),
            userAPI('/users/@me/guilds', tokenData.access_token)
        ]).then(([user, allGuilds]) => {
            console.log('[OAuth] User:', user?.username, 'Guilds:', Array.isArray(allGuilds) ? allGuilds.length : 'N/A');
            if (!user?.id) return res.redirect('/login.html?error=user_failed');

            const guilds = Array.isArray(allGuilds)
                ? allGuilds.filter(g => (parseInt(g.permissions) & 0x20) === 0x20).map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner, permissions: g.permissions }))
                : [];
            console.log('[OAuth] Admin guilds:', guilds.length);

            const token = db.createSession(
                { id: user.id, username: sanitize(user.username), discriminator: user.discriminator || '0', avatar: user.avatar, global_name: sanitize(user.global_name || user.username) },
                guilds.map(g => ({ ...g, name: sanitize(g.name) }))
            );

            console.log('[OAuth] Success! Redirecting to dashboard');
            res.cookie('bk_session', token, {
                maxAge: 90 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
            res.redirect('/dashboard.html');
        });
    }).catch(err => {
        console.error('[OAuth] Exception:', err.message);
        res.redirect('/login.html?error=callback_error');
    });
});

app.get('/logout', (req, res) => {
    const token = req.cookies.bk_session;
    if (token) db.destroySession(token);
    res.clearCookie('bk_session', { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.clearCookie('bk_csrf', { path: '/', sameSite: 'strict' });
    res.redirect('/login.html');
});

// ====== API Routes ======

app.get('/api/user', apiLimiter, authMiddleware, (req, res) => {
    const u = req.user;
    res.json({
        logged_in: true, id: u.id, username: u.username, global_name: u.global_name,
        discriminator: u.discriminator,
        avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${parseInt(u.discriminator) % 5}.png`
    });
});

app.get('/api/csrf', apiLimiter, (req, res) => {
    res.json({ token: res.locals.csrfToken });
});

app.get('/api/session', apiLimiter, authMiddleware, (req, res) => {
    res.json({ valid: true, user: { id: req.user.id, username: req.user.username } });
});

app.get('/api/session/refresh', apiLimiter, authMiddleware, (req, res) => {
    const oldToken = req.cookies.bk_session;
    if (oldToken) {
        const session = db.getSession(oldToken);
        if (session) {
            db.destroySession(oldToken);
            const newToken = db.createSession(session.user, session.guilds);
            res.cookie('bk_session', newToken, {
                maxAge: 90 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
        }
    }
    res.json({ ok: true });
});

app.get('/api/honeypot', apiLimiter, authMiddleware, (req, res) => {
    const client = global.botClient;
    if (client && client.honeypot) {
        res.json({ enabled: client.honeypot.enabled, log: client.honeypot.log.slice(-50).reverse() });
    } else {
        res.json({ enabled: false, log: [] });
    }
});

app.get('/api/guilds', apiLimiter, authMiddleware, (req, res) => {
    res.json(req.guilds || []);
});

app.get('/api/guild/:id', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const botInGuild = req.guilds ? req.guilds.some(g => g.id === guildId) : false;
    console.log(`[API] Guild: ${guildId}`);

    botAPI(`/guilds/${guildId}?with_counts=true`).then(guild => {
        if (guild.code || guild.message || guild._status >= 400 || guild._error) {
            return res.json({ error: guild.message || 'Failed', bot_in_guild: botInGuild, name: req.guilds?.find(g=>g.id===guildId)?.name || 'Unknown' });
        }

        if (!botInGuild) {
            return res.json({
                id: guild.id, name: guild.name,
                icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
                member_count: guild.approximate_member_count || guild.member_count || 0, online_count: guild.approximate_presence_count || 0,
                boost_count: guild.premium_subscription_count || 0,
                channel_count: 0, role_count: 0,
                text_channels: [], voice_channels: [], categories: [], roles: [],
                bot_permissions: 0, bot_in_guild: false,
                profile: db.getGuildProfile(guildId), settings: db.getGuildSettings(guildId),
                user: req.guilds?.find(g => g.id === guildId) || null
            });
        }

        return Promise.all([
            botAPI(`/guilds/${guildId}/channels`),
            botAPI(`/guilds/${guildId}/roles`),
            botAPI(`/guilds/${guildId}/members?limit=1000`)
        ]).then(([ch, rl, mb]) => {
            const channels = Array.isArray(ch) ? ch : [];
            const roles = Array.isArray(rl) ? rl : [];
            const members = Array.isArray(mb) ? mb : [];

            const textChannels = channels.filter(c => c.type === 0).sort((a,b) => a.position - b.position).map(c => ({ id: c.id, name: c.name }));
            const voiceChannels = channels.filter(c => c.type === 2).sort((a,b) => a.position - b.position).map(c => ({ id: c.id, name: c.name }));
            const categoryChannels = channels.filter(c => c.type === 4).sort((a,b) => a.position - b.position).map(c => ({ id: c.id, name: c.name }));
            const allRoles = roles.filter(r => !r.managed && r.name !== '@everyone').sort((a,b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }));
            const everyoneRole = roles.find(r => r.name === '@everyone');

            const botMember = members.find(m => m.user && m.user.id === '1537980470782988439');
            let botPerms = 0;
            if (everyoneRole) botPerms = everyoneRole.permissions;
            if (botMember) {
                (botMember.roles || []).forEach(rid => {
                    const role = roles.find(r => r.id === rid);
                    if (role) botPerms |= role.permissions;
                });
            }

            const onlineMembers = members.filter(m => m.status && m.status !== 'offline').length;
            const humanMembers = members.filter(m => !m.user?.bot).length;
            const botCount = members.filter(m => m.user?.bot).length;

            console.log(`[API] ${channels.length}ch ${roles.length}rl ${members.length}mb`);
            res.json({
                id: guild.id, name: guild.name,
                icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null,
                banner: guild.banner ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.png?size=600` : null,
                description: guild.description,
                member_count: guild.approximate_member_count || guild.member_count || members.length || 0,
                online_count: guild.approximate_presence_count || onlineMembers,
                human_count: humanMembers, bot_count: botCount,
                boost_count: guild.premium_subscription_count || 0,
                boost_level: guild.premium_tier || 0,
                channel_count: channels.length, role_count: roles.length,
                text_channels: textChannels, voice_channels: voiceChannels,
                categories: categoryChannels, roles: allRoles,
                bot_permissions: botPerms, bot_in_guild: botInGuild,
                owner_id: guild.owner_id,
                features: guild.features || [],
                profile: db.getGuildProfile(guildId),
                settings: db.getGuildSettings(guildId),
                user: req.guilds?.find(g => g.id === guildId) || null
            });
        });
    }).catch(err => {
        console.error('[API] Guild error:', err.message);
        res.json({ error: err.message, bot_in_guild: botInGuild });
    });
});

// ====== Settings API ======

app.get('/api/guild/:id/settings', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    res.json(db.getGuildSettings(req.params.id.replace(/[^0-9]/g, '')));
});

app.post('/api/guild/:id/settings', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const allowed = ['welcome_channel','welcome_message','welcome_enabled','welcome_dm','welcome_embed','welcome_color','log_channel','ticket_channel','ticket_category',
        'ticket_support_role','ticket_max','ticket_transcript',
        'stats_category','muted_role','auto_role','autorole_enabled','autorole_delay','autorole_delay_time','greet_role',
        'anti_spam','anti_link','anti_raid','anti_nuke','auto_mute_spam','auto_delete_links','auto_kick_unverified','lockdown_on_raid','honeypot_enabled',
        'level_channel','level_multiplier','level_enabled',
        'log_messages','log_moderation','log_joinleave','log_edits','log_voice',
        'dm_on_ban','dm_on_kick','dm_on_mute','embed_mode',
        'spam_threshold','raid_threshold','raid_timeframe','punish_cooldown','mute_duration'];
    const filtered = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) filtered[k] = typeof req.body[k] === 'string' ? sanitize(req.body[k]) : req.body[k]; });
    db.saveGuildSettings(guildId, filtered);
    res.json({ ok: true, settings: db.getGuildSettings(guildId) });
});

// ====== Profile API ======

app.get('/api/guild/:id/profile', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    res.json(db.getGuildProfile(req.params.id.replace(/[^0-9]/g, '')));
});

app.post('/api/guild/:id/profile', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const allowed = ['banner','color','description','links','tags'];
    const filtered = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) filtered[k] = typeof req.body[k] === 'string' ? sanitize(req.body[k]) : req.body[k]; });
    db.saveGuildProfile(guildId, filtered);
    res.json({ ok: true, profile: db.getGuildProfile(guildId) });
});

// ====== Custom Commands API ======

app.get('/api/guild/:id/commands', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    res.json(db.customCommands.get(req.params.id.replace(/[^0-9]/g, ''), {}));
});

app.post('/api/guild/:id/commands', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const { name, response, enabled } = req.body;
    if (!name || typeof name !== 'string') return res.json({ error: 'Invalid name' });
    const cleanName = sanitize(name.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30));
    const cleanResponse = sanitize((response || '').substring(0, 500));
    if (!cleanName) return res.json({ error: 'Invalid name' });
    const cmds = db.customCommands.get(guildId, {});
    cmds[cleanName] = { name: cleanName, response: cleanResponse, enabled: enabled !== false, created: Date.now() };
    db.customCommands.set(guildId, cmds);
    res.json({ ok: true, commands: cmds });
});

app.delete('/api/guild/:id/commands/:name', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const cmdName = sanitize(req.params.name.replace(/[^a-zA-Z0-9_-]/g, ''));
    const cmds = db.customCommands.get(guildId, {});
    delete cmds[cmdName];
    db.customCommands.set(guildId, cmds);
    res.json({ ok: true, commands: cmds });
});

// ====== Bot Stats ======

app.get('/api/stats', apiLimiter, (req, res) => { res.json(db.getStats()); });

// ====== Invite ======

app.get('/api/guild/:id/invite', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&guild_id=${req.params.id.replace(/[^0-9]/g, '')}&permissions=8&scope=bot%20applications.commands`);
});

// ====== Bot Info ======

app.get('/api/botinfo', apiLimiter, (req, res) => {
    botAPI('/users/@me').then(me => {
        const avatarURL = me.avatar
            ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;
        res.json({ id: me.id, username: me.username, avatar: avatarURL, stats: db.getStats() });
    }).catch(() => res.json({ username: 'BK BOT', avatar: '', stats: db.getStats() }));
});

// ====== Activity Feed ======

app.get('/api/activity', apiLimiter, (req, res) => {
    const stats = db.getStats();
    const activity = db.botStats.get('activity_feed', []);
    res.json(activity.slice(-50).reverse());
});


// ====== Emojis API ======

app.get('/api/guild/:id/emojis', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/emojis`).then(emojis => {
        if (!Array.isArray(emojis)) return res.json([]);
        res.json(emojis.map(e => ({ id: e.id, name: e.name, url: e.url, animated: e.animated, available: e.available })));
    }).catch(() => res.json([]));
});

// ====== Stickers API ======

app.get('/api/guild/:id/stickers', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/stickers`).then(stickers => {
        if (!Array.isArray(stickers)) return res.json([]);
        res.json(stickers.map(s => ({ id: s.id, name: s.name, description: s.description, format_type: s.format_type })));
    }).catch(() => res.json([]));
});

// ====== Webhooks API ======

app.get('/api/guild/:id/webhooks', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/webhooks`).then(webhooks => {
        if (!Array.isArray(webhooks)) return res.json([]);
        res.json(webhooks.map(w => ({ id: w.id, name: w.name, channel_id: w.channel_id, avatar: w.avatar })));
    }).catch(() => res.json([]));
});

// ====== Invites API ======

app.get('/api/guild/:id/invites', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/invites`).then(invites => {
        if (!Array.isArray(invites)) return res.json([]);
        res.json(invites.map(i => ({ code: i.code, uses: i.uses, max_uses: i.max_uses, creator: i.inviter, channel: i.channel, created_at: i.created_at, temporary: i.temporary })));
    }).catch(() => res.json([]));
});

// ====== Invite Management API ======

app.post('/api/guild/:id/invites', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const { channel_id, max_age, max_uses, temporary } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'Channel ID required' });
    botAPI(`/guilds/${guildId}/channels/${channel_id}/invites`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_age: max_age || 86400, max_uses: max_uses || 0, temporary: temporary || false })
    }).then(invite => {
        if (invite.code) {
            res.json({ ok: true, invite: { code: invite.code, url: `https://discord.gg/${invite.code}`, uses: 0, max_uses: invite.max_uses, max_age: invite.max_age } });
        } else {
            res.json({ error: invite.message || 'Failed to create invite' });
        }
    }).catch(e => res.json({ error: e.message }));
});

app.delete('/api/guild/:id/invites/:code', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const code = req.params.code;
    botAPI(`/guilds/${guildId}/invites/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

// ====== Webhook Management API ======

app.post('/api/guild/:id/webhooks', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const { name, channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'Channel ID required' });
    botAPI(`/guilds/${guildId}/webhooks`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || 'BK BOT Webhook', channel_id })
    }).then(wh => {
        if (wh.id) {
            res.json({ ok: true, webhook: { id: wh.id, name: wh.name, channel_id: wh.channel_id } });
        } else {
            res.json({ error: wh.message || 'Failed to create webhook' });
        }
    }).catch(e => res.json({ error: e.message }));
});

app.patch('/api/guild/:id/webhooks/:whId', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const { whId } = req.params;
    const { name, channel_id } = req.body;
    const body = {};
    if (name) body.name = name;
    if (channel_id) body.channel_id = channel_id;
    botAPI(`/webhooks/${whId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(wh => {
        if (wh.id) res.json({ ok: true, webhook: { id: wh.id, name: wh.name, channel_id: wh.channel_id } });
        else res.json({ error: wh.message || 'Failed to update webhook' });
    }).catch(e => res.json({ error: e.message }));
});

app.delete('/api/guild/:id/webhooks/:whId', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    botAPI(`/webhooks/${req.params.whId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

app.post('/api/guild/:id/webhooks/:whId/send', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const { whId } = req.params;
    let { content, username, avatar_url } = req.body;
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Content required' });
    content = content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\*\*```/g, '```').substring(0, 2000);
    if (username && typeof username === 'string') username = username.replace(/[\u0000-\u001F\u007F]/g, '').substring(0, 80);
    if (avatar_url && typeof avatar_url === 'string' && !/^https?:\/\//i.test(avatar_url)) avatar_url = undefined;
    fetch(`https://discord.com/api/webhooks/${whId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, username: username || undefined, avatar_url: avatar_url || undefined })
    }).then(r => r.json()).then(d => {
        if (d.id) res.json({ ok: true });
        else res.json({ error: d.message || 'Failed to send' });
    }).catch(e => res.json({ error: e.message }));
});

// ====== Tags CRUD API ======

app.post('/api/guild/:id/tags', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const { name, response } = req.body;
    if (!name || !response) return res.status(400).json({ error: 'Name and response required' });
    const cleanName = sanitize(name.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30));
    const tagsFile = path.join(__dirname, 'data', 'tags.json');
    let tags = {};
    try { tags = JSON.parse(fs.readFileSync(tagsFile, 'utf8')); } catch(e) {}
    if (!tags[guildId]) tags[guildId] = {};
    tags[guildId][cleanName] = { name: cleanName, response: sanitize(response.substring(0, 500)), created: Date.now() };
    fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
    res.json({ ok: true, tags: tags[guildId] });
});

app.delete('/api/guild/:id/tags/:name', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const tagClean = sanitize(req.params.name.replace(/[^a-zA-Z0-9_-]/g, ''));
    const tagsFile = path.join(__dirname, 'data', 'tags.json');
    let tags = {};
    try { tags = JSON.parse(fs.readFileSync(tagsFile, 'utf8')); } catch(e) {}
    if (tags[guildId]) delete tags[guildId][tagClean];
    fs.writeFileSync(tagsFile, JSON.stringify(tags, null, 2));
    res.json({ ok: true });
});

// ====== Emoji Delete API ======

app.delete('/api/guild/:id/emojis/:emojiId', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/emojis/${req.params.emojiId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

// ====== Scheduled Events API ======

app.get('/api/guild/:id/events', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/scheduled-events`).then(events => {
        if (!Array.isArray(events)) return res.json([]);
        res.json(events.map(e => ({ id: e.id, name: e.name, description: e.description, status: e.status, scheduled_start_time: e.scheduled_start_time, scheduled_end_time: e.scheduled_end_time, entity_type: e.entity_type })));
    }).catch(() => res.json([]));
});

// ====== Backup API ======

app.get('/api/guild/:id/backup', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const guildBackups = Object.entries(backups).filter(([_, b]) => b.guildId === guildId).map(([id, b]) => ({
        id, guildName: b.guildName, memberCount: b.memberCount, created: b.created,
        channels: b.channels?.length || 0, roles: b.roles?.length || 0,
        emojis: b.emojis?.length || 0, members: b.members?.length || 0,
        bans: b.bans?.length || 0, webhooks: b.webhooks?.length || 0,
        messages: b.messageCount || Object.values(b.messages || {}).reduce((a, m) => a + m.length, 0),
        messageChannels: b.messageChannels || Object.keys(b.messages || {}).length
    }));
    res.json(guildBackups);
});

app.post('/api/guild/:id/backup', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const settings = db.getGuildSettings(guildId);
    const customCmds = db.customCommands.get(guildId, {});
    const levelData = db.levelData.get(guildId, {});
    const warnings = db.warnings.get(guildId, {});
    const id = `bkp_${Date.now()}`;
    const deep = req.body.deep !== false;
    console.log(`[Backup] Creating backup for guild ${guildId}, deep: ${deep}`);

    botAPI(`/guilds/${guildId}?with_counts=true`).then(guild => {
        if (guild.code) throw new Error(guild.message || 'Failed to fetch guild');
        return Promise.all([
            botAPI(`/guilds/${guildId}/channels`),
            botAPI(`/guilds/${guildId}/roles`),
            botAPI(`/guilds/${guildId}/emojis`),
            botAPI(`/guilds/${guildId}/stickers`).catch(() => []),
            botAPI(`/guilds/${guildId}/invites`).catch(() => []),
            botAPI(`/guilds/${guildId}/bans`).catch(() => []),
            botAPI(`/guilds/${guildId}/webhooks`).catch(() => []),
            botAPI(`/guilds/${guildId}/members?limit=1000`).catch(() => [])
        ]).then(([channels, roles, emojis, stickers, invites, bans, webhooks, members]) => {
            const chArr = Array.isArray(channels) ? channels : [];
            const rlArr = Array.isArray(roles) ? roles : [];
            const emArr = Array.isArray(emojis) ? emojis : [];
            const stArr = Array.isArray(stickers) ? stickers : [];
            const invArr = Array.isArray(invites) ? invites : [];
            const banArr = Array.isArray(bans) ? bans : [];
            const whArr = Array.isArray(webhooks) ? webhooks : [];
            const mbArr = Array.isArray(members) ? members : [];

            const backupData = {
                guildId, guildName: req.body.guildName || guild.name || 'Server',
                icon: guild.icon, banner: guild.banner, description: guild.description,
                settings, customCommands: customCmds, levelData, warnings,
                channels: chArr.map(c => ({
                    id: c.id, name: c.name, type: c.type, topic: c.topic || '',
                    nsfw: c.nsfw || false, slowmode: c.rate_limit_per_user || 0,
                    position: c.position, parent_id: c.parent_id,
                    bitrate: c.bitrate, user_limit: c.user_limit
                })),
                roles: rlArr.map(r => ({
                    id: r.id, name: r.name, color: r.color, permissions: r.permissions,
                    position: r.position, hoist: r.hoist, mentionable: r.mentionable,
                    managed: r.managed, icon: r.icon, unicode_emoji: r.unicode_emoji
                })),
                emojis: emArr.map(e => ({ id: e.id, name: e.name, url: e.url, animated: e.animated })),
                stickers: stArr.map(s => ({ id: s.id, name: s.name, description: s.description, url: s.url })),
                invites: invArr.map(i => ({ code: i.code, uses: i.uses, max_uses: i.max_uses, channel: i.channel, inviter: i.inviter, created_at: i.created_at, temporary: i.temporary })),
                bans: banArr.map(b => ({ user: b.user, reason: b.reason })),
                webhooks: whArr.map(w => ({ id: w.id, name: w.name, channel_id: w.channel_id, avatar: w.avatar })),
                members: mbArr.map(m => ({ id: m.user?.id, username: m.user?.username, roles: m.roles, joined_at: m.joined_at, nick: m.nick, premium_since: m.premium_since })),
                memberCount: guild.member_count || 0,
                onlineCount: guild.approximate_presence_count || 0,
                boostCount: guild.premium_subscription_count || 0,
                boostTier: guild.premium_tier || 0,
                owner_id: guild.owner_id,
                features: guild.features || [],
                created: Date.now()
            };

            if (deep) {
                const textChannels = chArr.filter(c => c.type === 0).slice(0, 10);
                const messagePromises = textChannels.map(ch =>
                    botAPI(`/channels/${ch.id}/messages?limit=100`).catch(() => [])
                );
                return Promise.all(messagePromises).then(messagesArr => {
                    const messages = {};
                    textChannels.forEach((ch, i) => {
                        const msgs = Array.isArray(messagesArr[i]) ? messagesArr[i] : [];
                        messages[ch.id] = msgs.map(m => ({
                            id: m.id, content: m.content, author: m.author?.username,
                            authorId: m.author?.id, timestamp: m.timestamp,
                            attachments: (m.attachments || []).map(a => ({ url: a.url, filename: a.filename, size: a.size, content_type: a.content_type })),
                            embeds: (m.embeds || []).map(e => ({ title: e.title, description: e.description, url: e.url, color: e.color })),
                            reactions: (m.reactions || []).map(r => ({ emoji: r.emoji?.name, count: r.count })),
                            pinned: m.pinned || false, type: m.type
                        }));
                    });
                    backupData.messages = messages;
                    backupData.messageChannels = Object.keys(messages).length;
                    backupData.messageCount = Object.values(messages).reduce((a, m) => a + m.length, 0);
                    backups[id] = backupData;
                    fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));
                    console.log(`[Backup] Created ${id}: ${backupData.messageCount} messages from ${backupData.messageChannels} channels`);
                    res.json({ ok: true, id, backup: { id, guildName: backupData.guildName, channels: backupData.channels.length, roles: backupData.roles.length, messages: backupData.messageCount || 0, emojis: backupData.emojis.length, members: backupData.members.length, created: backupData.created } });
                });
            }

            backups[id] = backupData;
            fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));
            res.json({ ok: true, id, backup: { id, guildName: backupData.guildName, channels: backupData.channels.length, roles: backupData.roles.length, messages: 0, emojis: backupData.emojis.length, members: backupData.members.length, created: backupData.created } });
        });
    }).catch(err => {
        console.error('[Backup] Error:', err.message);
        res.status(500).json({ ok: false, error: 'Backup failed: ' + err.message });
    });
});

app.get('/api/guild/:id/backup/:backupId', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const backup = backups[req.params.backupId];
    if (!backup || backup.guildId !== guildId) return res.status(404).json({ error: 'Backup not found' });
    res.json(backup);
});

app.delete('/api/guild/:id/backup/:backupId', apiLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    if (backups[req.params.backupId] && backups[req.params.backupId].guildId === guildId) {
        delete backups[req.params.backupId];
        fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));
    }
    res.json({ ok: true });
});

// ====== Backup Restore API ======

app.post('/api/guild/:id/backup/:backupId/restore', restoreLimiter, csrfCheck, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const backup = backups[req.params.backupId];
    if (!backup || backup.guildId !== guildId) return res.status(404).json({ error: 'Backup not found' });

    console.log(`[Restore] Restoring backup ${req.params.backupId} for guild ${guildId}`);

    const settings = { ...db.getGuildSettings(guildId), ...(backup.settings || {}) };
    db.saveGuildSettings(guildId, settings);
    if (backup.customCommands) db.customCommands.set(guildId, backup.customCommands);
    if (backup.levelData) db.levelData.set(guildId, backup.levelData);
    if (backup.warnings) db.warnings.set(guildId, backup.warnings);

    const rolesArr = Array.isArray(backup.roles) ? backup.roles.filter(r => !r.managed && r.name !== '@everyone') : [];
    const channelsArr = Array.isArray(backup.channels) ? backup.channels : [];
    const categories = channelsArr.filter(c => c.type === 4);
    const others = channelsArr.filter(c => c.type === 0 || c.type === 2);

    const roleIds = {};
    const newChannels = {};

    const createRole = (r) => botAPI(`/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: r.name, color: r.color || 0, hoist: r.hoist || false, mentionable: r.mentionable || false,
            permissions: r.permissions || '0'
        })
    }).then(created => { if (created.id) roleIds[r.id] = created.id; });

    const createCategory = (c) => botAPI(`/guilds/${guildId}/channels`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, type: 4, position: c.position || 0 })
    }).then(created => { if (created.id) newChannels[c.id] = created.id; });

    const createChannel = (c) => {
        const body = { name: c.name, type: c.type, position: c.position || 0 };
        if (c.topic) body.topic = c.topic;
        if (c.nsfw) body.nsfw = true;
        if (c.slowmode) body.rate_limit_per_user = c.slowmode;
        if (c.parent_id && newChannels[c.parent_id]) body.parent_id = newChannels[c.parent_id];
        if (c.type === 2 && c.bitrate) body.bitrate = Math.min(parseInt(c.bitrate) || 64000, 384000);
        if (c.user_limit) body.user_limit = c.user_limit;
        return botAPI(`/guilds/${guildId}/channels`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(created => { if (created.id) newChannels[c.id] = created.id; });
    };

    const runSeq = (arr, fn) => arr.reduce((p, item) => p.then(() => fn(item)), Promise.resolve());

    runSeq(rolesArr, createRole)
        .then(() => runSeq(categories, createCategory))
        .then(() => runSeq(others, createChannel))
        .then(() => {
            const result = {
                ok: true,
                settings: true,
                customCommands: !!backup.customCommands,
                levels: !!backup.levelData,
                warnings: !!backup.warnings,
                rolesCreated: Object.keys(roleIds).length,
                channelsCreated: Object.keys(newChannels).length
            };
            console.log(`[Restore] Done: ${result.rolesCreated} roles, ${result.channelsCreated} channels created`);
            res.json(result);
        })
        .catch(err => {
            console.error('[Restore] Error:', err.message);
            res.status(500).json({ ok: false, error: 'Restore failed: ' + err.message });
        });
});

// ====== User Lookup API ======

app.get('/api/user/:id', userLookupLimiter, authMiddleware, (req, res) => {
    const userId = req.params.id.replace(/[^0-9]/g, '');
    if (userId.length < 17 || userId.length > 20) return res.status(400).json({ error: 'Invalid user ID' });
    const guildId = req.query.guild ? req.query.guild.replace(/[^0-9]/g, '') : null;
    console.log(`[UserLookup] Looking up user: ${userId}, guild: ${guildId}`);

    botAPI(`/users/${userId}`)
        .then(user => {
            console.log(`[UserLookup] Discord response:`, JSON.stringify(user).substring(0, 300));
            if (user._error || user._status >= 400 || user.code) {
                console.log(`[UserLookup] Error:`, user.message || user._error || user._raw);
                return res.status(404).json({ error: user.message || 'User not found. Make sure the ID is correct.' });
            }
            if (!user.id) {
                console.log(`[UserLookup] No id in response:`, user);
                return res.status(404).json({ error: 'Invalid response from Discord' });
            }

            const result = {
                id: user.id, username: user.username, discriminator: user.discriminator || '0',
                avatar: user.avatar, banner: user.banner, accent_color: user.accent_color,
                global_name: user.global_name, public_flags: user.public_flags, bot: user.bot || false,
                created_at: user.id ? new Date((BigInt(user.id) >> 22n) + 1420070400000n).toISOString() : null,
                flags: user.public_flags || 0
            };

            if (!guildId) return res.json(result);

            const hasAccess = req.guilds && req.guilds.some(g => g.id === guildId);
            if (!hasAccess) return res.json(result);

            Promise.all([
                botAPI(`/guilds/${guildId}/members/${userId}`).catch(() => null),
                botAPI(`/guilds/${guildId}/bans/${userId}`).catch(() => null),
                botAPI(`/guilds/${guildId}/roles`).catch(() => [])
            ]).then(([member, ban, guildRoles]) => {
                if (member && !member.code) {
                    const settings = db.getGuildSettings(guildId);
                    const mutedRoleId = settings?.muted_role;
                    const roles = Array.isArray(guildRoles) ? guildRoles : [];
                    const memberRoles = (member.roles || []).map(rid => {
                        const r = roles.find(x => x.id === rid);
                        return r ? { id: r.id, name: r.name, color: r.color, position: r.position } : { id: rid, name: 'Unknown', color: 0, position: 0 };
                    }).filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position);

                    let permFlags = 0;
                    const everyoneRole = roles.find(r => r.name === '@everyone');
                    if (everyoneRole) permFlags = everyoneRole.permissions;
                    (member.roles || []).forEach(rid => { const r = roles.find(x => x.id === rid); if (r) permFlags |= r.permissions; });

                    result.joined_at = member.joined_at;
                    result.nickname = member.nick;
                    result.roles = memberRoles;
                    result.role_count = memberRoles.length;
                    result.is_muted = mutedRoleId ? (member.roles || []).includes(mutedRoleId) : false;
                    result.is_deaf = member.deaf || false;
                    result.is_pending = member.pending || false;
                    result.premium_since = member.premium_since;
                    result.permissions = permFlags;
                    result.hoisted_role = memberRoles.find(r => r.hoist)?.name || null;
                    result.top_role = memberRoles[0]?.name || '@everyone';
                }

                result.is_banned = ban && !ban.code;
                result.ban_reason = ban?.reason || null;

                const userWarnings = db.warnings.get(guildId, {});
                const userWarns = userWarnings[userId] || [];
                result.warnings = userWarns.map(w => ({ reason: w.reason, moderator: w.moderator, date: w.date }));
                result.warning_count = userWarns.length;

                const guildLevels = db.levelData.get(guildId, {});
                const levelData = guildLevels[userId] || { xp: 0, level: 1 };
                result.level = levelData.level || 1;
                result.xp = levelData.xp || 0;
                result.xp_needed = (levelData.level || 1) * 100;

                const allLevels = Object.entries(guildLevels).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0));
                result.level_rank = allLevels.findIndex(([id]) => id === userId) + 1 || null;

                const activity = db.botStats.get('activity_feed', []);
                result.recent_activity = activity.filter(a => a.userId === userId || a.user === userId || a.targetId === userId).slice(-10).reverse();

                const notesFile = path.join(__dirname, 'data', 'user_notes.json');
                let notes = {};
                try { notes = JSON.parse(fs.readFileSync(notesFile, 'utf8')); } catch(e) {}
                result.notes = (notes[guildId] && notes[guildId][userId]) || [];

                res.json(result);
            }).catch(e => {
                console.error('[UserLookup] Guild data error:', e.message);
                res.json(result);
            });
        })
        .catch(e => res.status(500).json({ error: 'Failed to look up user' }));
});

app.post('/api/user/:id/notes', userLookupLimiter, csrfCheck, authMiddleware, (req, res) => {
    const userId = req.params.id.replace(/[^0-9]/g, '');
    const guildId = req.body.guild_id?.replace(/[^0-9]/g, '');
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });
    const hasAccess = req.guilds && req.guilds.some(g => g.id === guildId);
    if (!hasAccess) return res.status(403).json({ error: 'No access' });
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Note required' });
    const notesFile = path.join(__dirname, 'data', 'user_notes.json');
    let notes = {};
    try { notes = JSON.parse(fs.readFileSync(notesFile, 'utf8')); } catch(e) {}
    if (!notes[guildId]) notes[guildId] = {};
    if (!notes[guildId][userId]) notes[guildId][userId] = [];
    notes[guildId][userId].push({ text: sanitize(note.substring(0, 500)), author: req.user.username, date: new Date().toISOString() });
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
    res.json({ ok: true, notes: notes[guildId][userId] });
});

app.delete('/api/user/:id/notes/:index', userLookupLimiter, csrfCheck, authMiddleware, (req, res) => {
    const userId = req.params.id.replace(/[^0-9]/g, '');
    const guildId = req.query.guild?.replace(/[^0-9]/g, '') || req.body?.guild_id?.replace(/[^0-9]/g, '');
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });
    const hasAccess = req.guilds && req.guilds.some(g => g.id === guildId);
    if (!hasAccess) return res.status(403).json({ error: 'No access' });
    const notesFile = path.join(__dirname, 'data', 'user_notes.json');
    let notes = {};
    try { notes = JSON.parse(fs.readFileSync(notesFile, 'utf8')); } catch(e) {}
    if (notes[guildId]?.[userId]) {
        const idx = parseInt(req.params.index);
        if (!isNaN(idx)) notes[guildId][userId].splice(idx, 1);
        fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
    }
    res.json({ ok: true });
});

// ====== Tags API ======

app.get('/api/guild/:id/tags', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const tagsFile = path.join(__dirname, 'data', 'tags.json');
    let tags = {};
    try { tags = JSON.parse(fs.readFileSync(tagsFile, 'utf8')); } catch(e) {}
    res.json(tags[guildId] || {});
});

// ====== Warning API ======

app.get('/api/guild/:id/warnings', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const warns = db.warnings.get(guildId, {});
    res.json(warns);
});

// ====== Level Data API ======

app.get('/api/guild/:id/levels', apiLimiter, authMiddleware, guildAuth, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const levels = db.levelData.get(guildId, {});
    const sorted = Object.entries(levels).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0)).slice(0, 50);
    res.json(sorted.map(([id, data]) => ({ userId: id, level: data.level || 1, xp: data.xp || 0 })));
});

// ====== Admin Panel (Hardened) ======

const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'bk-admin-2026').digest('hex');
const adminSessions = new Map();
const adminLoginAttempts = new Map();
const adminAuditLog = [];
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;
const ADMIN_SESSION_DURATION = 12 * 60 * 60 * 1000;

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Try again in 15 minutes.', retryAfter: 900 },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

const adminApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Admin API rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false
});

const adminActionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { error: 'Too many admin actions. Slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

function adminAudit(action, details, ip) {
    const entry = { action, details, ip, timestamp: new Date().toISOString() };
    adminAuditLog.unshift(entry);
    if (adminAuditLog.length > 500) adminAuditLog.length = 500;
    console.log(`[Admin Audit] ${action} from ${ip} - ${JSON.stringify(details)}`);
}

function getAdminIp(req) {
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
}

function adminAuth(req, res, next) {
    const token = req.cookies.bk_admin;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Unauthorized' });
    const sess = adminSessions.get(token);
    if (!sess) return res.status(401).json({ error: 'Invalid session' });
    if (Date.now() - sess.created > ADMIN_SESSION_DURATION) { adminSessions.delete(token); res.clearCookie('bk_admin'); return res.status(401).json({ error: 'Session expired' }); }
    sess.lastActivity = Date.now();
    req.adminIp = getAdminIp(req);
    next();
}

function adminCsrfCheck(req, res, next) {
    if (req.method === 'GET') return next();
    const cookieToken = req.cookies.bk_csrf;
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        adminAudit('CSRF_FAIL', { path: req.path }, getAdminIp(req));
        return res.status(403).json({ error: 'CSRF validation failed' });
    }
    next();
}

function validateUserId(id) {
    return typeof id === 'string' && /^\d{17,20}$/.test(id);
}

function validateGuildId(id) {
    return typeof id === 'string' && /^\d{17,20}$/.test(id);
}

function validateInput(obj, rules) {
    for (const [key, rule] of Object.entries(rules)) {
        const val = obj[key];
        if (rule.required && (val === undefined || val === null || val === '')) return `${key} is required`;
        if (val !== undefined && val !== null && val !== '') {
            if (rule.type === 'string' && typeof val !== 'string') return `${key} must be a string`;
            if (rule.type === 'number' && typeof val !== 'number') return `${key} must be a number`;
            if (rule.maxLen && typeof val === 'string' && val.length > rule.maxLen) return `${key} too long (max ${rule.maxLen})`;
            if (rule.pattern && !rule.pattern.test(val)) return `${key} has invalid format`;
            if (rule.enum && !rule.enum.includes(val)) return `${key} must be one of: ${rule.enum.join(', ')}`;
        }
    }
    return null;
}

// Purge expired admin sessions every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, sess] of adminSessions) {
        if (now - sess.created > ADMIN_SESSION_DURATION || (now - sess.lastActivity > 4 * 60 * 60 * 1000)) {
            adminSessions.delete(token);
        }
    }
    for (const [ip, data] of adminLoginAttempts) {
        if (now - data.resetAt > ADMIN_LOCKOUT_MS) adminLoginAttempts.delete(ip);
    }
}, 30 * 60 * 1000);

// ====== Admin Auth Routes ======

app.post('/admin/api/login', (req, res) => {
    const ip = getAdminIp(req);
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') return res.status(400).json({ error: 'Password required' });
    const pw = password.trim();
    if (pw.length === 0) return res.status(400).json({ error: 'Password required' });

    const attempts = adminLoginAttempts.get(ip) || { count: 0, resetAt: Date.now() };
    if (attempts.count >= ADMIN_MAX_ATTEMPTS && Date.now() - attempts.resetAt < ADMIN_LOCKOUT_MS) {
        const remaining = Math.ceil((ADMIN_LOCKOUT_MS - (Date.now() - attempts.resetAt)) / 60000);
        adminAudit('LOGIN_LOCKOUT', { remaining }, ip);
        return res.status(429).json({ error: `Account locked. Try again in ${remaining} minutes.`, retryAfter: remaining * 60 });
    }

    const passwordHash = crypto.createHash('sha256').update(pw).digest('hex');
    if (passwordHash !== ADMIN_PASSWORD_HASH) {
        attempts.count++;
        if (attempts.count >= ADMIN_MAX_ATTEMPTS) attempts.resetAt = Date.now();
        adminLoginAttempts.set(ip, attempts);
        adminAudit('LOGIN_FAIL', { attempts: attempts.count }, ip);
        const remaining = attempts.count >= ADMIN_MAX_ATTEMPTS ? Math.ceil(ADMIN_LOCKOUT_MS / 60000) : ADMIN_MAX_ATTEMPTS - attempts.count;
        return res.status(403).json({ error: 'Wrong password', attemptsLeft: Math.max(0, ADMIN_MAX_ATTEMPTS - attempts.count) });
    }

    adminLoginAttempts.delete(ip);

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { created: Date.now(), lastActivity: Date.now(), ip });
    res.cookie('bk_admin', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ADMIN_SESSION_DURATION,
        path: '/'
    });

    adminAudit('LOGIN_SUCCESS', {}, ip);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('bk_csrf', csrfToken, {
        httpOnly: false,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: ADMIN_SESSION_DURATION,
        path: '/'
    });
    res.json({ ok: true });
});

app.post('/admin/api/logout', adminAuth, (req, res) => {
    const token = req.cookies.bk_admin;
    if (token) adminSessions.delete(token);
    res.clearCookie('bk_admin', { path: '/' });
    adminAudit('LOGOUT', {}, req.adminIp);
    res.json({ ok: true });
});

app.get('/admin/api/check', (req, res) => {
    const token = req.cookies.bk_admin;
    res.json({ logged_in: !!(token && adminSessions.has(token) && /^[a-f0-9]{64}$/.test(token)) });
});

// ====== Admin API (All Protected) ======

function readLiveStats() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'live.json'), 'utf8'));
    } catch { return null; }
}

app.get('/admin/api/bot', adminAuth, adminApiLimiter, (req, res) => {
    const live = readLiveStats() || {};
    adminAudit('VIEW_BOT_STATUS', {}, req.adminIp);
    res.json({
        online: !!live.status && live.status === 'online',
        status: live.status || 'offline',
        tag: live.tag || 'Offline',
        id: live.id || null,
        avatar: live.avatar || null,
        ping: live.ping || 0,
        uptime: live.uptime || 0,
        startedAt: live.startedAt || null,
        memoryMB: live.memoryMB || 0,
        nodeVersion: live.nodeVersion || 'unknown',
        processUptime: live.processUptime || 0,
        totals: live.totals || { guilds: 0, members: 0, channels: 0, roles: 0, boosts: 0 },
        commands: live.commands || { count: 0, usage: {} },
        commandNames: live.commands?.names || [],
        hourly: live.hourly || [],
        lastSync: live.syncedAt || null,
        security: live.security || {},
        securityCfg: (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'security-config.json'), 'utf8')); } catch { return {}; } })(),
        afk: live.afk || 0,
        tickets: live.tickets || 0,
        reminders: live.reminders || 0,
        customCommands: live.customCommands || 0
    });
});

app.get('/admin/api/global-data', adminAuth, adminApiLimiter, (req, res) => {
    const allWarnings = db.warnings.getAll();
    const allLevels = db.levelData.getAll();
    const allCommands = db.customCommands.getAll();
    const guildSettingsAll = db.guildSettings.getAll();

    const warnings = [];
    for (const [gid, g] of Object.entries(allWarnings)) {
        if (!validateGuildId(gid)) continue;
        for (const [uid, arr] of Object.entries(g)) {
            if (!validateUserId(uid)) continue;
            for (const w of arr) warnings.push({ userId: uid, reason: sanitize(w.reason), moderator: sanitize(w.moderator), date: w.date, guildId: gid });
        }
    }
    warnings.sort((a, b) => new Date(b.date) - new Date(a.date));

    const levels = [];
    for (const [gid, g] of Object.entries(allLevels)) {
        if (!validateGuildId(gid)) continue;
        for (const [uid, d] of Object.entries(g)) {
            if (!validateUserId(uid)) continue;
            levels.push({ userId: uid, level: d.level || 1, xp: d.xp || 0, guildId: gid });
        }
    }
    levels.sort((a, b) => b.xp - a.xp);

    const commands = [];
    for (const [gid, g] of Object.entries(allCommands)) {
        if (!validateGuildId(gid)) continue;
        for (const [name, c] of Object.entries(g)) commands.push({ name, response: sanitize(c.response), enabled: c.enabled !== false, guildId: gid });
    }

    adminAudit('VIEW_GLOBAL_DATA', {}, req.adminIp);
    res.json({
        warnings: warnings.slice(0, 500),
        levels: levels.slice(0, 200),
        commands: commands.slice(0, 500),
        guildCount: Object.keys(guildSettingsAll).length
    });
});

app.get('/admin/api/overview', adminAuth, adminApiLimiter, async (req, res) => {
    try {
        db.botStats.load();
        const stats = db.botStats.get('global', {});
        const activity = db.botStats.get('activity_feed', []);
        const allGuildSettings = db.guildSettings.getAll();
        const allWarnings = db.warnings.getAll();
        const allLevels = db.levelData.getAll();
        const allCommands = db.customCommands.getAll();
        const allBackups = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'backups.json'), 'utf8')); } catch { return {}; } })();

        let totalMembers = 0, totalChannels = 0, totalBoosts = 0;
        const guildIds = Object.keys(allGuildSettings);

        const live = readLiveStats() || {};

        const liveGuildMembers = live.totals?.members || 0;
        const liveGuildCount = live.totals?.guilds || 0;

        for (const gid of guildIds) {
            if (!validateGuildId(gid)) continue;
            try {
                const gRes = await discordAPI(`/guilds/${gid}?with_counts=true`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
                if (isOk(gRes)) {
                    totalMembers += gRes.approximate_member_count || 0;
                    totalChannels += gRes.channels?.length || 0;
                    totalBoosts += gRes.premium_subscription_count || 0;
                }
            } catch {}
        }

        adminAudit('VIEW_OVERVIEW', {}, req.adminIp);
        res.json({
            stats: {
                servers: liveGuildCount || guildIds.length,
                totalMembers: liveGuildMembers || totalMembers,
                totalChannels: live.totals?.channels || totalChannels,
                totalBoosts: live.totals?.boosts || totalBoosts,
                commandsRun: stats.commands_run || 0,
                messagesSeen: stats.messages_seen || 0,
                warningsIssued: stats.warnings_issued || 0,
                bans: stats.bans || 0,
                kicks: stats.kicks || 0,
                mutes: stats.mutes || 0,
                uptime: live.uptime || stats.uptime || 0
            },
            guildIds,
            warningsCount: Object.values(allWarnings).reduce((sum, g) => sum + Object.values(g).reduce((s, arr) => s + arr.length, 0), 0),
            levelsCount: Object.values(allLevels).reduce((sum, g) => sum + Object.keys(g).length, 0),
            commandsCount: Object.values(allCommands).reduce((sum, g) => sum + Object.keys(g).length, 0),
            backupsCount: Object.keys(allBackups).length,
            recentActivity: activity.slice(0, 20),
            bot: {
                online: !!(live.status === 'online'),
                tag: live.tag || 'Offline',
                id: live.id || null,
                avatar: live.avatar || null,
                ping: live.ping || 0,
                uptime: live.uptime || 0,
                startedAt: live.startedAt || null,
                memoryMB: live.memoryMB || 0,
                nodeVersion: live.nodeVersion || null,
                totals: live.totals || { guilds: 0, members: 0, channels: 0, roles: 0, boosts: 0 },
                commandUsage: live.commands?.usage || {},
                commandsCount: live.commands?.count || 0,
                security: live.security || {},
                afk: live.afk || 0,
                tickets: live.tickets || 0,
                reminders: live.reminders || 0
            }
        });
    } catch (e) { console.error('[Overview Error]', e); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/admin/api/servers', adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const allGuildSettings = db.guildSettings.getAll();
        const live = readLiveStats() || {};
        const liveGuilds = {};
        for (const g of live.guilds || []) liveGuilds[g.id] = g;
        const servers = [];

        const guildIds = new Set(Object.keys(allGuildSettings));
        for (const g of live.guilds || []) if (g && g.id) guildIds.add(g.id);

        try {
            const guildsRes = await discordAPI('/users/@me/guilds?with_counts=true', { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
            if (isOk(guildsRes) && Array.isArray(guildsRes)) {
                for (const g of guildsRes) if (g && g.id) guildIds.add(g.id);
            }
        } catch {}

        for (const gid of guildIds) {
            if (!validateGuildId(gid)) continue;
            try {
                const lg = liveGuilds[gid] || {};
                let gRes = null;
                if (!lg.id) {
                    const r = await discordAPI(`/guilds/${gid}?with_counts=true`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
                    if (isOk(r)) gRes = r;
                }
                const settings = db.getGuildSettings(gid);
                const warnings = db.warnings.get(gid, {});
                const warnCount = Object.values(warnings).reduce((s, arr) => s + arr.length, 0);
                servers.push({
                    id: gid, name: sanitize(gRes?.name || lg.name || 'Unknown Server'), icon: gRes?.icon ?? lg.icon ?? null,
                    members: lg.members || gRes?.approximate_member_count || 0, online: gRes?.approximate_presence_count || 0,
                    channels: lg.channels || gRes?.channels?.length || 0, roles: lg.roles || gRes?.roles?.length || 0,
                    boosts: lg.boosts || gRes?.premium_subscription_count || 0, boostTier: gRes?.premium_tier || 0,
                    owner: gRes?.owner_id || lg.owner || null, features: gRes?.features || lg.features || [],
                    live: !!lg.id,
                    security: { antiNuke: settings.anti_nuke !== false, antiRaid: settings.anti_raid !== false, antiSpam: settings.anti_spam !== false, antiLink: settings.anti_link !== false },
                    warnings: warnCount
                });
            } catch { servers.push({ id: gid, name: 'Unknown Server', error: true }); }
        }
        servers.sort((a, b) => (b.members || 0) - (a.members || 0));
        adminAudit('VIEW_SERVERS', { count: servers.length }, req.adminIp);
        res.json(servers);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/admin/api/server/:id', adminAuth, adminApiLimiter, async (req, res) => {
    const gid = req.params.id.replace(/[^0-9]/g, '');
    if (!validateGuildId(gid)) return res.status(400).json({ error: 'Invalid guild ID' });
    try {
        const gRes = await discordAPI(`/guilds/${gid}?with_counts=true`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
        if (!isOk(gRes)) return res.status(404).json({ error: 'Guild not found' });
        const g = gRes;
        const chRes = await discordAPI(`/guilds/${gid}/channels`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
        const channels = isOk(chRes) ? chRes : [];
        const rolesRes = await discordAPI(`/guilds/${gid}/roles`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
        const roles = isOk(rolesRes) ? rolesRes : [];
        const settings = db.getGuildSettings(gid);
        const warnings = db.warnings.get(gid, {});
        const levels = db.levelData.get(gid, {});
        const commands = db.customCommands.get(gid, {});
        const backups = (() => { try { const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'backups.json'), 'utf8')); return Object.entries(all).filter(([k]) => k.startsWith(gid)).map(([id, b]) => ({ id, ...b })); } catch { return []; } })();

        const warningsFlat = [];
        for (const [uid, arr] of Object.entries(warnings)) {
            if (!validateUserId(uid)) continue;
            for (const w of arr) warningsFlat.push({ userId: uid, reason: sanitize(w.reason), moderator: sanitize(w.moderator), date: w.date });
        }
        warningsFlat.sort((a, b) => new Date(b.date) - new Date(a.date));

        const levelsSorted = Object.entries(levels).filter(([id]) => validateUserId(id)).map(([id, d]) => ({ userId: id, level: d.level || 1, xp: d.xp || 0 })).sort((a, b) => b.xp - a.xp).slice(0, 50);

        adminAudit('VIEW_SERVER_DETAIL', { guild: gid }, req.adminIp);
        res.json({ guild: g, channels, roles, settings, warnings: warningsFlat.slice(0, 100), levels: levelsSorted, commands: Object.values(commands), backups });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/admin/api/server/:id/members', adminAuth, adminApiLimiter, async (req, res) => {
    const gid = req.params.id.replace(/[^0-9]/g, '');
    if (!validateGuildId(gid)) return res.status(400).json({ error: 'Invalid guild ID' });
    const search = sanitize((req.query.search || '').toLowerCase().slice(0, 100));
    try {
        let members = [];
        let after = '0';
        for (let i = 0; i < 5; i++) {
            const mRes = await discordAPI(`/guilds/${gid}/members?limit=1000&after=${after}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
            if (!isOk(mRes) || !mRes.length) break;
            members.push(...mRes);
            after = mRes[mRes.length - 1].user.id;
            if (mRes.length < 1000) break;
        }
        if (search) members = members.filter(m => m.user.username.toLowerCase().includes(search) || m.user.id.includes(search) || (m.nick && m.nick.toLowerCase().includes(search)));
        members.sort((a, b) => (b.joined_at > a.joined_at ? 1 : -1));

        const rolesRes = await discordAPI(`/guilds/${gid}/roles`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
        const rolesMap = {};
        if (isOk(rolesRes) && Array.isArray(rolesRes)) {
            rolesRes.forEach(r => { rolesMap[r.id] = r.name; });
        }

        adminAudit('SEARCH_MEMBERS', { guild: gid, search }, req.adminIp);
        res.json(members.slice(0, 200).map(m => ({
            id: m.user.id, username: sanitize(m.user.username), avatar: m.user.avatar,
            nick: sanitize(m.nick), roles: (m.roles || []).map(rid => rolesMap[rid] || rid), joined: m.joined_at, boosted: m.premium_since
        })));
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/admin/api/server/:id/action', adminAuth, adminActionLimiter, adminCsrfCheck, async (req, res) => {
    const gid = req.params.id.replace(/[^0-9]/g, '');
    if (!validateGuildId(gid)) return res.status(400).json({ error: 'Invalid guild ID' });

    const { action, userId, reason, index, key, value } = req.body;

    if (action === 'setSetting') {
        const allowed = ['anti_nuke', 'anti_raid', 'anti_spam', 'anti_link', 'honeypot_enabled', 'auto_mute_spam', 'auto_delete_links', 'auto_kick_unverified', 'lockdown_on_raid'];
        if (!allowed.includes(key)) return res.status(400).json({ error: 'Invalid setting key' });
        const settings = db.getGuildSettings(gid);
        settings[key] = !!value;
        db.saveGuildSettings(gid, settings);
        adminAudit('SET_SETTING', { guild: gid, key, value: !!value }, req.adminIp);
        return res.json({ ok: true, message: `Setting ${key} updated` });
    }

    if (action === 'saveSettings') {
        const current = db.getGuildSettings(gid);
        const updates = req.body.settings || {};
        const allowedBools = ['welcome_enabled','custom_welcome_embed','auto_mod_enabled','anti_spam','anti_link','anti_raid','anti_nuke','level_enabled','log_messages','log_moderation','log_joinleave','log_edits'];
        const allowedStrings = ['welcome_channel','welcome_message','log_channel','ticket_channel','ticket_category','stats_category','muted_role','auto_role','greet_role','level_channel'];
        const allowedNums = ['level_multiplier','spam_threshold','raid_threshold','raid_timeframe'];
        const allowedArrs = ['link_whitelist'];
        const saved = {};
        for (const k of allowedBools) { if (updates[k] !== undefined) { current[k] = !!updates[k]; saved[k] = current[k]; } }
        for (const k of allowedStrings) { if (typeof updates[k] === 'string') { current[k] = sanitize(updates[k].slice(0, 200)); saved[k] = current[k]; } }
        for (const k of allowedNums) { if (updates[k] !== undefined) { current[k] = Math.max(0, Math.min(1000, parseInt(updates[k]) || 0)); saved[k] = current[k]; } }
        for (const k of allowedArrs) { if (Array.isArray(updates[k])) { current[k] = updates[k].slice(0, 50).map(s => sanitize(String(s).slice(0, 100))); saved[k] = current[k]; } }
        db.saveGuildSettings(gid, current);
        adminAudit('SAVE_SETTINGS', { guild: gid, keys: Object.keys(saved) }, req.adminIp);
        return res.json({ ok: true, settings: current, message: 'Settings saved' });
    }

    if (!userId || !validateUserId(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const validActions = ['ban', 'kick', 'unban', 'warn', 'deleteWarn'];
    if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const safeReason = typeof reason === 'string' ? sanitize(reason.slice(0, 500)) : '';

    async function sendDM(userId, content) {
        try {
            const dmRes = await discordAPI(`/users/@me/channels`, { method: 'POST', headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: { recipient_id: userId } });
            if (dmRes.id) {
                await discordAPI(`/channels/${dmRes.id}/messages`, { method: 'POST', headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: { content } });
                return true;
            }
        } catch (e) { console.log('[DM Error]', e.message); }
        return false;
    }

    try {
        if (action === 'ban') {
            await sendDM(userId, `**You have been banned from this server.**\n\n**Reason:** ${safeReason || 'No reason provided'}\n\nIf you believe this is a mistake, contact the server administrators.`);
            const banBody = { delete_message_seconds: 86400 };
            if (safeReason) banBody.reason = safeReason;
            const banRes = await discordAPI(`/guilds/${gid}/bans/${userId}`, { method: 'PUT', headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': encodeURIComponent(safeReason || 'Admin panel action') }, body: banBody });
            if (banRes.code) return res.status(400).json({ error: `Discord API error: ${banRes.message || banRes.code}` });
            const stats = db.botStats.get('global', {}); stats.bans = (stats.bans || 0) + 1; db.botStats.set('global', stats);
            adminAudit('BAN', { guild: gid, user: userId, reason: safeReason }, req.adminIp);
            res.json({ ok: true, message: `Banned **${userId}**` });
        } else if (action === 'kick') {
            await sendDM(userId, `**You have been kicked from this server.**\n\n**Reason:** ${safeReason || 'No reason provided'}\n\nYou may rejoin with a new invite.`);
            const kickRes = await discordAPI(`/guilds/${gid}/members/${userId}`, { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN}`, 'X-Audit-Log-Reason': encodeURIComponent(safeReason || 'Admin panel action') } });
            if (kickRes.code) return res.status(400).json({ error: `Discord API error: ${kickRes.message || kickRes.code}` });
            const stats = db.botStats.get('global', {}); stats.kicks = (stats.kicks || 0) + 1; db.botStats.set('global', stats);
            adminAudit('KICK', { guild: gid, user: userId, reason: safeReason }, req.adminIp);
            res.json({ ok: true, message: `Kicked ${userId}` });
        } else if (action === 'unban') {
            await discordAPI(`/guilds/${gid}/bans/${userId}`, { method: 'DELETE', headers: { Authorization: `Bot ${BOT_TOKEN}` } });
            adminAudit('UNBAN', { guild: gid, user: userId }, req.adminIp);
            res.json({ ok: true, message: `Unbanned ${userId}` });
        } else if (action === 'warn') {
            const warns = db.warnings.get(gid, {});
            if (!warns[userId]) warns[userId] = [];
            warns[userId].push({ reason: safeReason || 'Admin panel warning', moderator: 'Admin Panel', date: new Date().toISOString() });
            db.warnings.set(gid, warns);
            const warnCount = warns[userId].length;
            await sendDM(userId, `**You have been warned in this server.**\n\n**Reason:** ${safeReason || 'No reason provided'}\n**Warning #${warnCount}** — Further violations may result in a kick or ban.`);
            const stats = db.botStats.get('global', {}); stats.warnings_issued = (stats.warnings_issued || 0) + 1; db.botStats.set('global', stats);
            adminAudit('WARN', { guild: gid, user: userId, reason: safeReason }, req.adminIp);
            res.json({ ok: true, message: `Warned ${userId}` });
        } else if (action === 'deleteWarn') {
            const idx = parseInt(index);
            if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid index' });
            const warns = db.warnings.get(gid, {});
            if (warns[userId] && warns[userId][idx]) {
                warns[userId].splice(idx, 1);
                db.warnings.set(gid, warns);
            }
            adminAudit('DELETE_WARN', { guild: gid, user: userId, index: idx }, req.adminIp);
            res.json({ ok: true });
        }
    } catch (e) { adminAudit('ACTION_ERROR', { action, error: e.message }, req.adminIp); res.status(500).json({ error: 'Action failed' }); }
});

app.get('/admin/api/activity', adminAuth, adminApiLimiter, (req, res) => {
    db.botStats.load();
    const activity = db.botStats.get('activity_feed', []);
    adminAudit('VIEW_ACTIVITY', {}, req.adminIp);
    res.json(activity.slice(0, 100));
});

app.get('/admin/api/honeypot', adminAuth, adminApiLimiter, (req, res) => {
    db.botStats.load();
    const dbLog = db.botStats.get('honeypot_log', []);
    const live = readLiveStats() || {};
    const liveLog = live.honeypotLog || [];
    const merged = [...liveLog, ...dbLog].filter((e, i, arr) => arr.findIndex(x => x.time === e.time && x.userId === e.userId) === i);
    merged.sort((a, b) => (b.time || 0) - (a.time || 0));
    adminAudit('VIEW_HONEYPOT', {}, req.adminIp);
    res.json(merged.slice(0, 100));
});

app.get('/admin/api/audit', adminAuth, adminApiLimiter, (req, res) => {
    res.json(adminAuditLog.slice(0, 200));
});

app.get('/admin/api/security', adminAuth, adminApiLimiter, (req, res) => {
    try {
        const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'security-config.json'), 'utf8'));
        res.json(cfg);
    } catch { res.json({}); }
});

app.post('/admin/api/security', adminAuth, adminActionLimiter, adminCsrfCheck, (req, res) => {
    const allowed = ['anti_nuke', 'anti_raid', 'anti_spam', 'anti_link', 'honeypot', 'auto_mute_spam', 'auto_delete_links', 'auto_kick_unverified', 'lockdown_on_raid'];
    const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'security-config.json'), 'utf8')); } catch { return {}; } })();
    for (const [key, val] of Object.entries(req.body || {})) {
        if (allowed.includes(key)) cfg[key] = !!val;
    }
    fs.writeFileSync(path.join(__dirname, 'data', 'security-config.json'), JSON.stringify(cfg, null, 2));
    adminAudit('SECURITY_TOGGLE', { ...req.body }, req.adminIp);
    res.json({ ok: true, config: cfg });
});

// ====== 404 Handler ======

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ====== Error Handler ======

app.use((err, req, res, next) => {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ====== Start ======

app.listen(PORT, () => {
    console.log(`\n  BK BOT Dashboard Server`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  Redirect: ${REDIRECT_URI}`);
    console.log(`  Security: Helmet + Rate Limit + CSRF + Sanitization\n`);
});
