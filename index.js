require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, PermissionFlagsBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

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
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        if (command.cooldown) {
            if (client.cooldowns.has(command.data.name)) {
                const expirationTime = client.cooldowns.get(command.data.name) + command.cooldown;
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    return interaction.reply({ content: `Wait ${timeLeft.toFixed(1)}s`, ephemeral: true });
                }
            }
            client.cooldowns.set(command.data.name, Date.now());
            setTimeout(() => client.cooldowns.delete(command.data.name), command.cooldown);
        }

        await command.execute(interaction);
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

client.login(process.env.TOKEN);
