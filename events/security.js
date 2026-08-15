const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const client = message.client;

        // Anti-nuke: Monitor for suspicious bulk actions
        if (client.antiNuke && client.antiNuke.enabled) {
            const userId = message.author.id;
            
            // Skip trusted users
            if (!client.antiNuke.trustedUsers.includes(userId)) {
                // Track message velocity for potential webhook spam detection
                if (!client.antiNuke.violations.has(userId)) {
                    client.antiNuke.violations.set(userId, { count: 0, lastReset: Date.now() });
                }
                
                const userData = client.antiNuke.violations.get(userId);
                const now = Date.now();
                
                // Reset counter every 10 seconds
                if (now - userData.lastReset > 10000) {
                    userData.count = 0;
                    userData.lastReset = now;
                }
                
                userData.count++;
                client.antiNuke.violations.set(userId, userData);
            }
        }

        // Anti-spam
        if (client.antiSpam && client.antiSpam.enabled) {
            const now = Date.now();
            const userId = message.author.id;

            if (!client.antiSpam.violations.has(userId)) {
                client.antiSpam.violations.set(userId, []);
            }

            const messages = client.antiSpam.violations.get(userId);
            messages.push(now);

            const recentMessages = messages.filter(time => now - time < client.antiSpam.timeWindow);
            client.antiSpam.violations.set(userId, recentMessages);

            if (recentMessages.length >= client.antiSpam.messageLimit) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('🚫 Spam Detected')
                    .setDescription(`${message.author.tag} is spamming!`)
                    .setTimestamp();

                const logChannel = message.guild.channels.cache.find(ch => ch.name === 'mod-logs');
                if (logChannel) {
                    logChannel.send({ embeds: [embed] });
                }

                if (client.antiSpam.action === 'mute') {
                    let muteRole = message.guild.roles.cache.find(r => r.name === config.muteRole);
                    if (!muteRole) {
                        try {
                            muteRole = await message.guild.roles.create({
                                name: config.muteRole,
                                permissions: []
                            });
                        } catch (error) {
                            console.error('Failed to create mute role');
                        }
                    }

                    if (muteRole) {
                        try {
                            await message.member.roles.add(muteRole);
                            message.channel.send(`${message.author} has been muted for spamming.`);
                        } catch (error) {
                            console.error('Failed to mute spammer');
                        }
                    }
                } else if (client.antiSpam.action === 'kick') {
                    try {
                        await message.member.kick('Anti-spam: Spamming');
                        message.channel.send(`${message.author.tag} has been kicked for spamming.`);
                    } catch (error) {
                        console.error('Failed to kick spammer');
                    }
                } else if (client.antiSpam.action === 'ban') {
                    try {
                        await message.member.ban({ reason: 'Anti-spam: Spamming' });
                        message.channel.send(`${message.author.tag} has been banned for spamming.`);
                    } catch (error) {
                        console.error('Failed to ban spammer');
                    }
                } else if (client.antiSpam.action === 'warn') {
                    if (!client.warnings.has(message.author.id)) {
                        client.warnings.set(message.author.id, []);
                    }
                    const warnings = client.warnings.get(message.author.id);
                    warnings.push({
                        reason: 'Anti-spam: Spamming',
                        moderator: 'Anti-Spam System',
                        date: new Date().toISOString()
                    });
                    message.channel.send(`${message.author} has been warned for spamming.`);
                }

                client.antiSpam.violations.set(userId, []);
            }
        }

        // Anti-link
        if (client.antiLink && client.antiLink.enabled) {
            const urlRegex = /https?:\/\/[^\s]+/gi;
            const urls = message.content.match(urlRegex);

            if (urls) {
                for (const url of urls) {
                    try {
                        const domain = new URL(url).hostname.replace('www.', '');
                        const isWhitelisted = client.antiLink.whitelistedDomains.some(d => domain.includes(d));

                        if (!isWhitelisted && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                            const embed = new EmbedBuilder()
                                .setColor('#FFA500')
                                .setTitle('🔗 Link Detected')
                                .setDescription(`${message.author.tag} posted a link: ${url}`)
                                .setTimestamp();

                            const logChannel = message.guild.channels.cache.find(ch => ch.name === 'mod-logs');
                            if (logChannel) {
                                logChannel.send({ embeds: [embed] });
                            }

                            if (client.antiLink.action === 'delete') {
                                await message.delete();
                                message.channel.send(`${message.author}, links are not allowed here!`).then(msg => {
                                    setTimeout(() => msg.delete(), 5000);
                                });
                            } else if (client.antiLink.action === 'warn') {
                                await message.delete();
                                message.channel.send(`${message.author}, links are not allowed here! You have been warned.`);
                            } else if (client.antiLink.action === 'mute') {
                                await message.delete();
                                let muteRole = message.guild.roles.cache.find(r => r.name === config.muteRole);
                                if (!muteRole) {
                                    try {
                                        muteRole = await message.guild.roles.create({
                                            name: config.muteRole,
                                            permissions: []
                                        });
                                    } catch (error) {
                                        console.error('Failed to create mute role');
                                    }
                                }
                                if (muteRole) {
                                    await message.member.roles.add(muteRole);
                                    message.channel.send(`${message.author} has been muted for posting links.`);
                                }
                            } else if (client.antiLink.action === 'kick') {
                                await message.delete();
                                try {
                                    await message.member.kick('Anti-link: Posting unauthorized links');
                                    message.channel.send(`${message.author.tag} has been kicked for posting links.`);
                                } catch (error) {
                                    console.error('Failed to kick link poster');
                                }
                            }
                            break;
                        }
                    } catch (error) {
                        // Invalid URL format, skip
                    }
                }
            }
        }

        // Leveling system
        const userId2 = message.author.id;

        if (!client.levelData.has(userId2)) {
            client.levelData.set(userId2, { xp: 0, level: 1 });
        }

        const data = client.levelData.get(userId2);
        const xpGain = Math.floor(Math.random() * 15) + 5;
        data.xp += xpGain;

        const xpNeeded = data.level * 100;

        if (data.xp >= xpNeeded) {
            data.level++;
            data.xp = 0;

            const levelUpEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎉 Level Up!')
                .setDescription(`Congratulations ${message.author}! You've reached **Level ${data.level}**!`)
                .setTimestamp();

            message.channel.send({ embeds: [levelUpEmbed] });

            const levelRoles = config.levelRoles;
            if (levelRoles[data.level.toString()]) {
                const role = message.guild.roles.cache.find(r => r.name === levelRoles[data.level.toString()]);
                if (role) {
                    try {
                        await message.member.roles.add(role);
                    } catch (error) {
                        console.error('Failed to add level role');
                    }
                }
            }
        }

        client.levelData.set(userId2, data);
    }
};
