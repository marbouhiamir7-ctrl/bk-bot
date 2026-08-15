const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.WebhooksUpdate,
    once: false,
    async execute(channel) {
        const client = channel.client;

        if (!client.antiNuke || !client.antiNuke.enabled) return;

        const guild = channel.guild;
        const auditLogs = await guild.fetchAuditLogs({ type: 5, limit: 10 }); // WEBHOOK_CREATE

        for (const [id, entry] of auditLogs.entries) {
            const executor = entry.executor;

            // Skip trusted users and admins
            if (client.antiNuke.trustedUsers.includes(executor.id) || 
                executor.permissions.has(PermissionFlagsBits.Administrator)) {
                continue;
            }

            // Track webhook creation
            const key = `webhookCreate_${executor.id}`;
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

            if (data.count >= client.antiNuke.maxWebhookCreate) {
                // Webhook spam detected
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 Anti-Nuke: Webhook Spam Detected')
                    .setDescription(`${executor.tag} is creating webhooks rapidly!`)
                    .addFields(
                        { name: 'Action', value: 'Member has been banned', inline: true }
                    )
                    .setTimestamp();

                const logChannel = guild.channels.cache.find(ch => ch.name === 'mod-logs');
                if (logChannel) {
                    logChannel.send({ embeds: [embed] });
                }

                try {
                    await executor.ban({ reason: 'Anti-nuke: Webhook spam detected' });
                } catch (error) {
                    console.error('Failed to ban nuker');
                }

                // Delete all webhooks in the channel
                try {
                    const webhooks = await channel.fetchWebhooks();
                    for (const [id, webhook] of webhooks) {
                        await webhook.delete();
                    }
                } catch (error) {
                    console.error('Failed to delete webhooks');
                }

                client.antiNuke.violations.set(key, { count: 0, lastReset: Date.now() });
            }
        }
    }
};
