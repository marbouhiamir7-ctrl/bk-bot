const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.GuildChannelDelete,
    once: false,
    async execute(channel) {
        const client = channel.client;

        if (!client.antiNuke || !client.antiNuke.enabled) return;

        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ type: 4, limit: 10 }); // CHANNEL_DELETE

        for (const [id, entry] of auditLogs.entries) {
            if (entry.target.id === channel.id) {
                const executor = entry.executor;

                // Skip trusted users and admins
                if (client.antiNuke.trustedUsers.includes(executor.id) || 
                    executor.permissions.has(PermissionFlagsBits.Administrator)) {
                    continue;
                }

                // Track channel deletion
                const key = `channelDelete_${executor.id}`;
                if (!client.antiNuke.violations.has(key)) {
                    client.antiNuke.violations.set(key, { count: 0, lastReset: Date.now() });
                }

                const data = client.antiNuke.violations.get(key);
                const now = Date.now();

                if (now - data.lastReset > 10000) {
                    data.count = 0;
                    data.lastReset = now;
                }

                data.count++;
                client.antiNuke.violations.set(key, data);

                if (data.count >= client.antiNuke.maxChannelDelete) {
                    // Nuke detected
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🚨 Anti-Nuke: Mass Channel Deletion')
                        .setDescription(`${executor.tag} is deleting channels rapidly!`)
                        .addFields(
                            { name: 'Action', value: 'Member has been banned', inline: true }
                        )
                        .setTimestamp();

                    const logChannel = guild.channels.cache.find(ch => ch.name === 'mod-logs');
                    if (logChannel) {
                        logChannel.send({ embeds: [embed] });
                    }

                    try {
                        await executor.ban({ reason: 'Anti-nuke: Mass channel deletion detected' });
                    } catch (error) {
                        console.error('Failed to ban nuker');
                    }

                    client.antiNuke.violations.set(key, { count: 0, lastReset: Date.now() });
                }
            }
        }
    }
};
