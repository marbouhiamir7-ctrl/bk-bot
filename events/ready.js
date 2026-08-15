const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`✅ Logged in as ${client.user.tag}`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Serving ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} users`);

        updateAllStats(client);

        client.on(Events.GuildMemberAdd, () => updateAllStats(client));
        client.on(Events.GuildMemberRemove, () => updateAllStats(client));
        client.on(Events.PresenceUpdate, () => updateAllStats(client));
        client.on(Events.VoiceStateUpdate, () => updateAllStats(client));
        client.on(Events.GuildChannelCreate, () => updateAllStats(client));
        client.on(Events.GuildChannelDelete, () => updateAllStats(client));
        client.on(Events.GuildRoleCreate, () => updateAllStats(client));
        client.on(Events.GuildRoleDelete, () => updateAllStats(client));
    }
};

async function updateAllStats(client) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        await guild.members.fetch();

        const totalMembers = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const online = guild.members.cache.filter(m => 
            m.presence?.status === 'online' || 
            m.presence?.status === 'idle' || 
            m.presence?.status === 'dnd'
        ).size;
        const offline = totalMembers - online;
        const channels = guild.channels.cache.size;
        const roles = guild.roles.cache.size;
        const voiceMembers = guild.channels.cache
            .filter(c => c.type === 2)
            .reduce((acc, c) => acc + c.members.size, 0);
        const boosts = guild.premiumSubscriptionCount || 0;

        const statsUpdates = [
            { search: '🚀 boosts:', newName: `🚀 Boosts: ${boosts}` },
            { search: '💰 coins:', newName: `💰 Coins: 2.05M` },
            { search: '👥 total members:', newName: `👥 Total Members: ${totalMembers}` },
            { search: '😎 human members:', newName: `😎 Human Members: ${humans}` },
            { search: '🤖 bots:', newName: `🤖 Bots: ${bots}` },
            { search: '🟢 online members:', newName: `🟢 Online Members: ${online}` },
            { search: '⚫ offline members:', newName: `⚫ Offline Members: ${offline}` },
            { search: '📁 channels:', newName: `📁 Channels: ${channels}` },
            { search: '🎨 roles:', newName: `🎨 Roles: ${roles}` },
            { search: '🔊 voice members:', newName: `🔊 Voice Members: ${voiceMembers}` }
        ];

        for (const update of statsUpdates) {
            const channel = guild.channels.cache.find(c => 
                c.type === 2 && c.name.toLowerCase().startsWith(update.search)
            );
            if (channel && channel.name !== update.newName) {
                try {
                    await channel.setName(update.newName);
                } catch (e) {}
            }
        }
    } catch (error) {
        console.error('Stats update error:', error);
    }
}
