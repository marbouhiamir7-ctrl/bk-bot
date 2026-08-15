const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        const client = member.client;

        // Anti-raid check
        if (client.antiRaid && client.antiRaid.enabled) {
            const now = Date.now();
            const guildId = member.guild.id;

            if (!client.antiRaid.violations.has(guildId)) {
                client.antiRaid.violations.set(guildId, []);
            }

            const joins = client.antiRaid.violations.get(guildId);
            joins.push(now);

            const recentJoins = joins.filter(time => now - time < client.antiRaid.timeWindow);
            client.antiRaid.violations.set(guildId, recentJoins);

            if (recentJoins.length >= client.antiRaid.joinLimit) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 Raid Detected!')
                    .setDescription(`${recentJoins.length} members joined in ${client.antiRaid.timeWindow / 1000} seconds!`)
                    .setTimestamp();

                const logChannel = member.guild.channels.cache.find(ch => ch.name === 'mod-logs');
                if (logChannel) {
                    logChannel.send({ embeds: [embed] });
                }

                if (client.antiRaid.action === 'kick') {
                    const raiders = member.guild.members.cache.filter(m => 
                        !m.permissions.has('Administrator') &&
                        (now - m.joinedTimestamp) < client.antiRaid.timeWindow
                    );

                    raiders.forEach(async (raider) => {
                        try {
                            await raider.kick('Anti-raid: Raid detected');
                        } catch (error) {
                            console.error(`Failed to kick raider: ${raider.user.tag}`);
                        }
                    });

                    embed.setDescription(`Kicked ${raiders.size} suspected raiders.`);
                } else if (client.antiRaid.action === 'ban') {
                    const raiders = member.guild.members.cache.filter(m => 
                        !m.permissions.has('Administrator') &&
                        (now - m.joinedTimestamp) < client.antiRaid.timeWindow
                    );

                    raiders.forEach(async (raider) => {
                        try {
                            await raider.ban({ reason: 'Anti-raid: Raid detected' });
                        } catch (error) {
                            console.error(`Failed to ban raider: ${raider.user.tag}`);
                        }
                    });

                    embed.setDescription(`Banned ${raiders.size} suspected raiders.`);
                }

                if (logChannel) {
                    logChannel.send({ embeds: [embed] });
                }
            }
        }

        // Welcome message
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannel);

        if (!welcomeChannel) return;

        const welcomeMessage = config.welcomeMessage.replace('{user}', `${member}`);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`Welcome to ${member.guild.name}!`)
            .setDescription(welcomeMessage)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Member #${member.guild.memberCount}` })
            .setTimestamp();

        welcomeChannel.send({ embeds: [embed] });

        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle(`Welcome to ${member.guild.name}!`)
                .setDescription(`Thank you for joining **${member.guild.name}**!\n\nEnjoy your stay and have fun!`)
                .setTimestamp();

            await member.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log('Could not send DM to new member');
        }
    }
};
