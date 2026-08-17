require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, PermissionFlagsBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const db = require('./db');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildWebhooks
    ]
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.customCommands = new Map();
client.levelData = new Map();
client.warnings = new Map();
client.tickets = new Map();
client.reminders = new Map();
client.afkUsers = new Map();
client.commandUsage = new Map();

client.antiNuke = {
    enabled: true,
    logChannel: null,
    trustedUsers: [],
    maxChannelDelete: 3,
    maxRoleDelete: 3,
    maxBans: 5,
    maxChannelCreate: 5,
    maxWebhookCreate: 2,
    violations: new Map()
};

client.antiRaid = {
    enabled: true,
    joinLimit: 5,
    timeWindow: 10000,
    action: 'kick',
    violations: new Map()
};

client.antiSpam = {
    enabled: true,
    messageLimit: 5,
    timeWindow: 5000,
    action: 'mute',
    violations: new Map()
};

client.antiLink = {
    enabled: true,
    action: 'delete',
    whitelistedDomains: ['discord.gg', 'youtube.com', 'github.com']
};

client.honeypot = {
    enabled: true,
    trapCommands: ['.token', '.eval', '.exec', '.hack', '.grabtoken', '.steal', '.raid', '.nuke', '.spam', '.ddos', '.rat', '.selfbot', '.webhook', '.snipe'],
    honeypotKeywords: ['give me mod', 'give me admin', 'i am admin', 'trust me', 'give perms', 'promote me', 'i own this', 'transfer ownership', 'i paid for this', 'discord admin', 'staff here'],
    violations: new Map(),
    log: []
};

const SECURITY_CFG_FILE = path.join(__dirname, 'data', 'security-config.json');

function applySecurityConfig() {
    try {
        if (!fs.existsSync(SECURITY_CFG_FILE)) return;
        const cfg = JSON.parse(fs.readFileSync(SECURITY_CFG_FILE, 'utf8'));
        if (typeof cfg.anti_nuke === 'boolean') client.antiNuke.enabled = cfg.anti_nuke;
        if (typeof cfg.anti_raid === 'boolean') client.antiRaid.enabled = cfg.anti_raid;
        if (typeof cfg.anti_spam === 'boolean') client.antiSpam.enabled = cfg.anti_spam;
        if (typeof cfg.anti_link === 'boolean') client.antiLink.enabled = cfg.anti_link;
        if (typeof cfg.honeypot === 'boolean') client.honeypot.enabled = cfg.honeypot;
    } catch (e) {}
}

// ====== Live Stats Sync (bot -> admin panel) ======
const LIVE_FILE = path.join(__dirname, 'data', 'live.json');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LIVE_START = Date.now();
let msgCount = 0, cmdCount = 0;
let pendingHourlyCmds = 0;
const activityBuffer = [];
client.hourlyUsage = new Map();

function pushActivity(type, message, guildId) {
    activityBuffer.push({ type, message, guildId: guildId || null, time: Date.now() });
    if (activityBuffer.length > 50) activityBuffer.length = 50;
}

function flushActivity() {
    if (!activityBuffer.length) return;
    try {
        const feed = db.botStats.get('activity_feed', []);
        feed.unshift(...activityBuffer);
        if (feed.length > 200) feed.length = 200;
        db.botStats.set('activity_feed', feed);
    } catch (e) {}
    activityBuffer.length = 0;
}

function trackCommand(name, userTag, guildName) {
    cmdCount++;
    pendingHourlyCmds++;
    client.commandUsage.set(name, (client.commandUsage.get(name) || 0) + 1);
    pushActivity('command', `**/${name}** used by **${userTag}** in ${guildName || 'DMs'}`);
}

function syncLiveStats() {
    try {
        applySecurityConfig();
        flushActivity();
        const stats = db.botStats.get('global', {});
        stats.commands_run = (stats.commands_run || 0) + cmdCount;
        stats.messages_seen = (stats.messages_seen || 0) + msgCount;
        stats.uptime = Math.floor((Date.now() - LIVE_START) / 1000);
        db.botStats.set('global', stats);
        msgCount = 0; cmdCount = 0;

        const hourly = Array(24).fill(0);
        const now = new Date();
        const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
        client.hourlyUsage.set(hourKey, (client.hourlyUsage.get(hourKey) || 0) + pendingHourlyCmds);
        pendingHourlyCmds = 0;
        const today = new Date();
        for (const [key, count] of client.hourlyUsage) {
            const parts = key.split('-');
            const h = parseInt(parts[3]);
            const sameDay = parseInt(parts[0]) === today.getFullYear() && parseInt(parts[1]) === today.getMonth() && parseInt(parts[2]) === today.getDate();
            if (sameDay) hourly[h] += count;
            else if (hourly[h] === 0 && count > 0) hourly[h] += count;
        }

        const guilds = client.guilds.cache.map(g => ({
            id: g.id, name: g.name, icon: g.icon,
            members: g.memberCount || 0,
            channels: g.channels.cache.size,
            roles: g.roles.cache.size,
            boosts: g.premiumSubscriptionCount || 0,
            owner: g.ownerId || null,
            createdAt: g.createdAt ? g.createdAt.toISOString() : null
        }));

        const live = {
            status: client.isReady() ? 'online' : 'connecting',
            tag: client.user ? client.user.tag : null,
            id: client.user ? client.user.id : null,
            avatar: client.user ? client.user.displayAvatarURL({ size: 128 }) : null,
            ping: client.ws.ping || 0,
            uptime: Math.floor((Date.now() - LIVE_START) / 1000),
            startedAt: new Date(LIVE_START).toISOString(),
            memoryMB: Math.round(process.memoryUsage().rss / 1048576),
            nodeVersion: process.version,
            processUptime: Math.floor(process.uptime()),
            guilds,
            totals: {
                guilds: guilds.length,
                members: guilds.reduce((a, g) => a + g.members, 0),
                channels: guilds.reduce((a, g) => a + g.channels, 0),
                roles: guilds.reduce((a, g) => a + g.roles, 0),
                boosts: guilds.reduce((a, g) => a + g.boosts, 0)
            },
            commands: {
                count: client.commands.size,
                usage: Object.fromEntries(client.commandUsage || []),
                names: [...client.commands.keys()].sort()
            },
            hourly,
            security: {
                nuke: { enabled: client.antiNuke.enabled, maxChannelDelete: client.antiNuke.maxChannelDelete, maxBans: client.antiNuke.maxBans, maxChannelCreate: client.antiNuke.maxChannelCreate, maxWebhookCreate: client.antiNuke.maxWebhookCreate, violations: client.antiNuke.violations.size },
                raid: { enabled: client.antiRaid.enabled, joinLimit: client.antiRaid.joinLimit, timeWindow: client.antiRaid.timeWindow, action: client.antiRaid.action },
                spam: { enabled: client.antiSpam.enabled, messageLimit: client.antiSpam.messageLimit, timeWindow: client.antiSpam.timeWindow, action: client.antiSpam.action },
                link: { enabled: client.antiLink.enabled, action: client.antiLink.action, whitelistedDomains: client.antiLink.whitelistedDomains },
                honeypot: { enabled: client.honeypot.enabled, violations: client.honeypot.violations.size, logCount: client.honeypot.log.length }
            },
            honeypotLog: client.honeypot.log.slice(0, 100),
            afk: client.afkUsers.size,
            tickets: client.tickets.size,
            reminders: client.reminders.size,
            customCommands: client.customCommands.size,
            syncedAt: Date.now()
        };
        fs.writeFileSync(LIVE_FILE, JSON.stringify(live));
    } catch (e) { console.error('syncLiveStats error:', e.message); }
}
setInterval(syncLiveStats, 10000);

function isHoneypotTrigger(message) {
    const lower = message.content.toLowerCase().trim();
    const userId = message.author.id;
    
    for (const cmd of client.honeypot.trapCommands) {
        if (lower.startsWith(cmd) || lower.includes(cmd)) {
            return { type: 'trap_command', value: cmd };
        }
    }
    
    for (const kw of client.honeypot.honeypotKeywords) {
        if (lower.includes(kw)) {
            return { type: 'social_engineering', value: kw };
        }
    }
    
    if (/https?:\/\/[^\s]+discord[^\s]*(token|auth|login|steal)/i.test(lower)) {
        return { type: 'phishing_link', value: 'phishing attempt' };
    }
    
    if (/\b(airdrop|free nitro|free boost|click here to claim|verify here|verify now)\b/i.test(lower)) {
        return { type: 'scam_link', value: 'scam attempt' };
    }
    
    return null;
}

async function handleHoneypot(message, result) {
    const userId = message.author.id;
    const guild = message.guild;
    
    const strikes = (client.honeypot.violations.get(userId) || 0) + 1;
    client.honeypot.violations.set(userId, strikes);
    
    client.honeypot.log.push({
        user: message.author.tag,
        userId,
        type: result.type,
        value: result.value,
        channel: message.channel.name,
        time: Date.now(),
        strikes
    });
    
    if (client.honeypot.log.length > 100) client.honeypot.log.shift();
    
    try {
        const hplog = db.botStats.get('honeypot_log', []);
        hplog.unshift({ user: message.author.tag, userId, type: result.type, value: result.value, channel: message.channel.name, time: Date.now(), strikes });
        if (hplog.length > 100) hplog.length = 100;
        db.botStats.set('honeypot_log', hplog);
        pushActivity('honeypot', `**${message.author.tag}** triggered honeypot (${result.type}) in **${message.guild.name}**`, message.guild.id);
    } catch (e) {}
    
    try { await message.delete(); } catch(e) {}
    
    if (result.type === 'phishing_link' || result.type === 'scam_link' || strikes >= 2) {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.bannable) {
                await member.ban({ reason: `[Honeypot] ${result.type}: ${result.value} (${strikes} strikes)` });
                const logCh = guild.channels.cache.find(c => c.name === 'mod-logs' || c.name === 'audit-log');
                if (logCh) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Honeypot Triggered')
                        .setDescription(`**${message.author.tag}** has been banned automatically`)
                        .addFields(
                            { name: 'Type', value: result.type, inline: true },
                            { name: 'Trigger', value: result.value, inline: true },
                            { name: 'Strikes', value: `${strikes}`, inline: true }
                        )
                        .setTimestamp();
                    logCh.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch(e) {}
        client.honeypot.violations.delete(userId);
    } else {
        try {
            const warnEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('Honeypot Warning')
                .setDescription(`**${message.author.tag}**, this is a warning. Further violations will result in a ban.`)
                .addFields({ name: 'Type', value: result.type, inline: true })
                .setTimestamp();
            message.channel.send({ embeds: [warnEmbed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
        } catch(e) {}
    }
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`📋 ${client.commands.size} commands loaded`);
    client.user.setActivity('Baktiriya Team | /help', { type: 'Watching' });
    syncLiveStats();
});

client.on(Events.GuildMemberAdd, member => {
    pushActivity('join', `**${member.user.tag}** joined **${member.guild.name}**`, member.guild.id);
    syncLiveStats();
});

client.on(Events.GuildMemberRemove, member => {
    pushActivity('leave', `**${member.user.tag}** left **${member.guild.name}**`, member.guild.id);
    syncLiveStats();
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        if (command.cooldown) {
            const cooldownKey = `${command.data.name}_${interaction.user.id}`;
            if (client.cooldowns.has(cooldownKey)) {
                const expirationTime = client.cooldowns.get(cooldownKey) + command.cooldown;
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    return interaction.reply({ content: `Wait ${timeLeft.toFixed(1)}s`, ephemeral: true });
                }
            }
            client.cooldowns.set(cooldownKey, Date.now());
            setTimeout(() => client.cooldowns.delete(cooldownKey), command.cooldown);
        }

        await command.execute(interaction);
        trackCommand(command.data.name, interaction.user.tag, interaction.guild?.name);
    } catch (error) {
        console.error(`Error in ${interaction.commandName}:`, error);
        const reply = { content: 'Error executing command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Admin only!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Ticket Closing')
            .setDescription('Closing in 5 seconds...')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {}
        }, 5000);
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    msgCount++;

    if (client.honeypot.enabled) {
        const hpResult = isHoneypotTrigger(message);
        if (hpResult) {
            await handleHoneypot(message, hpResult).catch(() => {});
            return;
        }
    }

    if (client.afkUsers.has(message.author.id)) {
        const afk = client.afkUsers.get(message.author.id);
        client.afkUsers.delete(message.author.id);
        try {
            const nick = afk.originalNickname || message.author.username;
            await message.member.setNickname(nick.substring(0, 32));
            message.reply({ content: `Welcome back! Removed AFK (was AFK for ${formatDuration(Date.now() - afk.since)})`, ephemeral: true }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        } catch(e) {}
    }

    const mentioned = message.mentions.users.first();
    if (mentioned && client.afkUsers.has(mentioned.id)) {
        const afk = client.afkUsers.get(mentioned.id);
        message.reply({ content: `${mentioned.username} is AFK: ${afk.reason} (${formatDuration(Date.now() - afk.since)} ago)` }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
    }
});

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
    const h = Math.floor(s/3600);
    return `${h}h ${Math.floor((s%3600)/60)}m`;
}

client.login(process.env.TOKEN).then(() => {
    global.botClient = client;
});
