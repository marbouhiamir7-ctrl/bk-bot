const express = require('express');
const path = require('path');
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
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.removeHeader('X-Powered-By');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (req.path.endsWith('.html') || !req.path.includes('.')) {
        res.setHeader('Surrogate-Control', 'no-store');
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

app.use(generalLimiter);

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
    if (req.method !== 'GET' && headerToken !== cookieToken) {
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
    const blocked = ['.env', 'db.js', 'index.js', 'server.js', 'check.js', 'package.json', 'config.json', 'node_modules'];
    if (blocked.some(b => req.path.includes(b))) {
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

app.get('/api/csrf', (req, res) => {
    res.json({ token: res.locals.csrfToken });
});

app.get('/api/session', apiLimiter, authMiddleware, (req, res) => {
    res.json({ valid: true, user: { id: req.user.id, username: req.user.username } });
});

app.get('/api/session/refresh', apiLimiter, authMiddleware, (req, res) => {
    const token = req.cookies.bk_session;
    if (token) {
        res.cookie('bk_session', token, {
            maxAge: 90 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });
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

app.get('/api/guild/:id', apiLimiter, authMiddleware, (req, res) => {
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
                member_count: guild.member_count || 0, online_count: guild.approximate_presence_count || 0,
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
                member_count: guild.member_count || 0,
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

app.get('/api/guild/:id/settings', apiLimiter, authMiddleware, (req, res) => {
    res.json(db.getGuildSettings(req.params.id.replace(/[^0-9]/g, '')));
});

app.post('/api/guild/:id/settings', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const allowed = ['welcome_channel','welcome_message','welcome_enabled','welcome_dm','welcome_embed','welcome_color','log_channel','ticket_channel','ticket_category',
        'ticket_support_role','ticket_max','ticket_transcript',
        'stats_category','muted_role','auto_role','autorole_enabled','autorole_delay','autorole_delay_time','greet_role',
        'anti_spam','anti_link','anti_raid','anti_nuke','anti_spam','auto_mute_spam','auto_delete_links','auto_kick_unverified','lockdown_on_raid',
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

app.get('/api/guild/:id/profile', apiLimiter, authMiddleware, (req, res) => {
    res.json(db.getGuildProfile(req.params.id.replace(/[^0-9]/g, '')));
});

app.post('/api/guild/:id/profile', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const allowed = ['banner','color','description','links','tags'];
    const filtered = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) filtered[k] = typeof req.body[k] === 'string' ? sanitize(req.body[k]) : req.body[k]; });
    db.saveGuildProfile(guildId, filtered);
    res.json({ ok: true, profile: db.getGuildProfile(guildId) });
});

// ====== Custom Commands API ======

app.get('/api/guild/:id/commands', apiLimiter, authMiddleware, (req, res) => {
    res.json(db.customCommands.get(req.params.id.replace(/[^0-9]/g, ''), {}));
});

app.post('/api/guild/:id/commands', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
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

app.delete('/api/guild/:id/commands/:name', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const cmdName = sanitize(req.params.name.replace(/[^a-zA-Z0-9_-]/g, ''));
    const cmds = db.customCommands.get(guildId, {});
    delete cmds[cmdName];
    db.customCommands.set(guildId, cmds);
    res.json({ ok: true, commands: cmds });
});

// ====== Bot Stats ======

app.get('/api/stats', (req, res) => { res.json(db.getStats()); });

// ====== Invite ======

app.get('/api/guild/:id/invite', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&guild_id=${req.params.id.replace(/[^0-9]/g, '')}&permissions=8&scope=bot%20applications.commands`);
});

// ====== Bot Info ======

app.get('/api/botinfo', (req, res) => {
    botAPI('/users/@me').then(me => {
        res.json({ id: me.id, username: me.username, stats: db.getStats() });
    }).catch(() => res.json({ username: 'BK BOT', stats: db.getStats() }));
});

// ====== Activity Feed ======

app.get('/api/activity', apiLimiter, (req, res) => {
    const stats = db.getStats();
    const activity = db.botStats.get('activity_feed', []);
    res.json(activity.slice(-50).reverse());
});

// ====== User Lookup ======

app.get('/api/user/:id', apiLimiter, (req, res) => {
    const userId = req.params.id.replace(/[^0-9]/g, '');
    if (!userId) return res.json({ error: 'Invalid user ID' });
    botAPI(`/users/${userId}`).then(user => {
        if (user.code) return res.json({ error: 'User not found' });
        res.json({ id: user.id, username: user.username, avatar: user.avatar, discriminator: user.discriminator });
    }).catch(() => res.json({ error: 'Failed to fetch user' }));
});

// ====== Emojis API ======

app.get('/api/guild/:id/emojis', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/emojis`).then(emojis => {
        if (!Array.isArray(emojis)) return res.json([]);
        res.json(emojis.map(e => ({ id: e.id, name: e.name, url: e.url, animated: e.animated, available: e.available })));
    }).catch(() => res.json([]));
});

// ====== Stickers API ======

app.get('/api/guild/:id/stickers', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/stickers`).then(stickers => {
        if (!Array.isArray(stickers)) return res.json([]);
        res.json(stickers.map(s => ({ id: s.id, name: s.name, description: s.description, format_type: s.format_type })));
    }).catch(() => res.json([]));
});

// ====== Webhooks API ======

app.get('/api/guild/:id/webhooks', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/webhooks`).then(webhooks => {
        if (!Array.isArray(webhooks)) return res.json([]);
        res.json(webhooks.map(w => ({ id: w.id, name: w.name, channel_id: w.channel_id, avatar: w.avatar })));
    }).catch(() => res.json([]));
});

// ====== Invites API ======

app.get('/api/guild/:id/invites', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/invites`).then(invites => {
        if (!Array.isArray(invites)) return res.json([]);
        res.json(invites.map(i => ({ code: i.code, uses: i.uses, max_uses: i.max_uses, creator: i.inviter, channel: i.channel, created_at: i.created_at, temporary: i.temporary })));
    }).catch(() => res.json([]));
});

// ====== Invite Management API ======

app.post('/api/guild/:id/invites', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
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

app.delete('/api/guild/:id/invites/:code', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const code = req.params.code;
    botAPI(`/guilds/${guildId}/invites/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

// ====== Webhook Management API ======

app.post('/api/guild/:id/webhooks', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
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

app.patch('/api/guild/:id/webhooks/:whId', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
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

app.delete('/api/guild/:id/webhooks/:whId', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    botAPI(`/webhooks/${req.params.whId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

app.post('/api/guild/:id/webhooks/:whId/send', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const { whId } = req.params;
    const { content, username, avatar_url } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    fetch(`https://discord.com/api/webhooks/${whId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.substring(0, 2000), username: username || undefined, avatar_url: avatar_url || undefined })
    }).then(r => r.json()).then(d => {
        if (d.id) res.json({ ok: true });
        else res.json({ error: d.message || 'Failed to send' });
    }).catch(e => res.json({ error: e.message }));
});

// ====== Tags CRUD API ======

app.post('/api/guild/:id/tags', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const fs = require('fs');
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

app.delete('/api/guild/:id/tags/:name', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const fs = require('fs');
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

app.delete('/api/guild/:id/emojis/:emojiId', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/emojis/${req.params.emojiId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    }).then(() => res.json({ ok: true })).catch(e => res.json({ error: e.message }));
});

// ====== Scheduled Events API ======

app.get('/api/guild/:id/events', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    botAPI(`/guilds/${guildId}/scheduled-events`).then(events => {
        if (!Array.isArray(events)) return res.json([]);
        res.json(events.map(e => ({ id: e.id, name: e.name, description: e.description, status: e.status, scheduled_start_time: e.scheduled_start_time, scheduled_end_time: e.scheduled_end_time, entity_type: e.entity_type })));
    }).catch(() => res.json([]));
});

// ====== Backup API ======

app.get('/api/guild/:id/backup', apiLimiter, authMiddleware, (req, res) => {
    const fs = require('fs');
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const guildBackups = Object.entries(backups).filter(([_, b]) => b.guildId === guildId).map(([id, b]) => ({
        id, guildName: b.guildName, memberCount: b.memberCount, created: b.created,
        channels: b.channels?.length || 0, roles: b.roles?.length || 0
    }));
    res.json(guildBackups);
});

app.post('/api/guild/:id/backup', apiLimiter, csrfCheck, authMiddleware, (req, res) => {
    const fs = require('fs');
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const backupsFile = path.join(__dirname, 'data', 'backups.json');
    let backups = {};
    try { backups = JSON.parse(fs.readFileSync(backupsFile, 'utf8')); } catch(e) {}
    const settings = db.getGuildSettings(guildId);
    const id = `bkp_${Date.now()}`;
    backups[id] = { guildId, guildName: req.body.guildName || 'Server', settings, created: Date.now() };
    fs.writeFileSync(backupsFile, JSON.stringify(backups, null, 2));
    res.json({ ok: true, id });
});

// ====== Tags API ======

app.get('/api/guild/:id/tags', apiLimiter, authMiddleware, (req, res) => {
    const fs = require('fs');
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const tagsFile = path.join(__dirname, 'data', 'tags.json');
    let tags = {};
    try { tags = JSON.parse(fs.readFileSync(tagsFile, 'utf8')); } catch(e) {}
    res.json(tags[guildId] || {});
});

// ====== Warning API ======

app.get('/api/guild/:id/warnings', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const warns = db.warnings.get(guildId, {});
    res.json(warns);
});

// ====== Level Data API ======

app.get('/api/guild/:id/levels', apiLimiter, authMiddleware, (req, res) => {
    const guildId = req.params.id.replace(/[^0-9]/g, '');
    const levels = db.levelData.get(guildId, {});
    const sorted = Object.entries(levels).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0)).slice(0, 50);
    res.json(sorted.map(([id, data]) => ({ userId: id, level: data.level || 1, xp: data.xp || 0 })));
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
