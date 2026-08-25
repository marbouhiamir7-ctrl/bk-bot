const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class Database {
    constructor(name) {
        this.file = path.join(DATA_DIR, `${name}.json`);
        this.data = {};
        this.load();
    }

    load() {
        try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
        catch (e) { this.data = {}; }
    }

    save() {
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    }

    get(key, defaultVal = null) {
        return this.data[key] !== undefined ? this.data[key] : defaultVal;
    }

    set(key, val) {
        this.data[key] = val;
        this.save();
    }

    delete(key) {
        delete this.data[key];
        this.save();
    }

    getAll() { return this.data; }
}

const sessions = new Database('sessions');
const guildSettings = new Database('guild-settings');
const guildProfiles = new Database('guild-profiles');
const userData = new Database('user-data');
const botStats = new Database('bot-stats');
const customCommands = new Database('custom-commands');
const levelData = new Database('level-data');
const warnings = new Database('warnings');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function createSession(user, guilds) {
    const payload = {
        user,
        guilds,
        created: Date.now(),
        expires: Date.now() + (90 * 24 * 60 * 60 * 1000)
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function getSession(token) {
    if (!token || !token.includes('.')) return null;
    try {
        const [data, sig] = token.split('.');
        const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
        if (sig !== expected) return null;
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (Date.now() > payload.expires) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function destroySession(token) {
    // Signed tokens can't be revoked without a blocklist; cookie expiry handles it
}

function getGuildSettings(guildId) {
    const defaults = {
        welcome_channel: '',
        welcome_message: 'Welcome to the server, {user}!',
        welcome_enabled: true,
        log_channel: '',
        ticket_channel: '',
        ticket_category: '',
        stats_category: '',
        muted_role: '',
        auto_role: '',
        anti_spam: true,
        anti_link: true,
        anti_raid: true,
        anti_nuke: true,
        level_channel: '',
        level_multiplier: 1,
        level_enabled: true,
        greet_role: '',
        custom_welcome_embed: false,
        auto_mod_enabled: true,
        link_whitelist: [],
        spam_threshold: 5,
        raid_threshold: 10,
        raid_timeframe: 10,
        log_messages: true,
        log_moderation: true,
        log_joinleave: true,
        log_edits: true
    };
    const stored = guildSettings.get(guildId, null);
    return stored ? { ...defaults, ...stored } : { ...defaults };
}

function saveGuildSettings(guildId, settings) {
    const current = getGuildSettings(guildId);
    guildSettings.set(guildId, { ...current, ...settings });
}

function getGuildProfile(guildId) {
    return guildProfiles.get(guildId, {
        banner: null,
        color: '#FF6B6B',
        description: '',
        links: [],
        tags: [],
        created_at: Date.now()
    });
}

function saveGuildProfile(guildId, profile) {
    const current = getGuildProfile(guildId);
    guildProfiles.set(guildId, { ...current, ...profile });
}

function incrementStat(key, amount = 1) {
    const stats = botStats.get('global', { commands_run: 0, messages_seen: 0, warnings_issued: 0, bans: 0, kicks: 0, mutes: 0, tickets: 0, uptime: 0 });
    stats[key] = (stats[key] || 0) + amount;
    botStats.set('global', stats);
    return stats;
}

function getStats() {
    return botStats.get('global', { commands_run: 0, messages_seen: 0, warnings_issued: 0, bans: 0, kicks: 0, mutes: 0, tickets: 0, uptime: 0 });
}

module.exports = {
    sessions, guildSettings, guildProfiles, userData, botStats, customCommands, levelData, warnings,
    createSession, getSession, destroySession,
    getGuildSettings, saveGuildSettings,
    getGuildProfile, saveGuildProfile,
    incrementStat, getStats
};
