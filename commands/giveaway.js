const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create a giveaway')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a new giveaway')
            .addStringOption(o => o.setName('prize').setDescription('What to give away').setRequired(true))
            .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
            .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to post in')))
        .addSubcommand(sub => sub.setName('reroll').setDescription('Reroll a giveaway')
            .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('end').setDescription('End a giveaway early')
            .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true))),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const prize = interaction.options.getString('prize');
            const duration = interaction.options.getInteger('duration');
            const winners = interaction.options.getInteger('winners') || 1;
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle(`🎉 Giveaway: ${prize}`)
                .setDescription(`**Hosted by:** ${interaction.user}\n\nReact with 🎉 to enter!\n\n**Duration:** ${duration} minutes\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor((Date.now() + duration * 60000) / 1000)}:R>`)
                .setFooter({ text: `ID: pending` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });
            await msg.react('🎉');

            embed.setFooter({ text: `ID: ${msg.id}` });
            await msg.edit({ embeds: [embed] });

            if (!interaction.client.giveaways) interaction.client.giveaways = new Map();
            interaction.client.giveaways.set(msg.id, {
                prize, winners, host: interaction.user.id,
                channelId: channel.id, guildId: interaction.guild.id,
                endsAt: Date.now() + duration * 60000, entries: []
            });

            await interaction.reply({ content: `Giveaway created in ${channel}!`, ephemeral: true });

            setTimeout(async () => {
                const gw = interaction.client.giveaways?.get(msg.id);
                if (!gw) return;
                interaction.client.giveaways.delete(msg.id);

                try {
                    const m = await channel.messages.fetch(msg.id);
                    const reaction = m.reactions.cache.get('🎉');
                    if (!reaction) return;

                    const users = await reaction.users.fetch();
                    const valid = users.filter(u => !u.bot);
                    const winnerIds = [];
                    const arr = [...valid.values()];
                    for (let i = 0; i < Math.min(gw.winners, arr.length); i++) {
                        const idx = Math.floor(Math.random() * arr.length);
                        winnerIds.push(arr.splice(idx, 1)[0].id);
                    }

                    const winEmbed = new EmbedBuilder()
                        .setColor('#34d399')
                        .setTitle(`🎉 Giveaway Ended: ${prize}`)
                        .setDescription(winnerIds.length > 0 ? `**Winners:** ${winnerIds.map(id => `<@${id}>`).join(', ')}\nCongratulations!` : 'No valid entries.')
                        .setTimestamp();

                    await m.edit({ embeds: [winEmbed], components: [] });
                    if (winnerIds.length > 0) await channel.send({ content: `Congratulations ${winnerIds.map(id => `<@${id}>`).join(', ')}! You won **${prize}**!` });
                } catch (e) {}
            }, duration * 60000);
        }

        if (sub === 'reroll') {
            const id = interaction.options.getString('message_id');
            try {
                const msg = await interaction.channel.messages.fetch(id);
                const reaction = msg.reactions.cache.get('🎉');
                if (!reaction) return interaction.reply({ content: 'No reactions found!', ephemeral: true });
                const users = await reaction.users.fetch();
                const valid = [...users.filter(u => !u.bot).values()];
                if (valid.length === 0) return interaction.reply({ content: 'No entries!', ephemeral: true });
                const winner = valid[Math.floor(Math.random() * valid.length)];
                await interaction.reply({ content: `Rerolled! New winner: <@${winner.id}>` });
            } catch (e) {
                await interaction.reply({ content: 'Could not find that giveaway!', ephemeral: true });
            }
        }

        if (sub === 'end') {
            const id = interaction.options.getString('message_id');
            if (!interaction.client.giveaways?.has(id)) return interaction.reply({ content: 'Giveaway not found or already ended!', ephemeral: true });
            interaction.client.giveaways.delete(id);
            await interaction.reply({ content: 'Giveaway ended!', ephemeral: true });
        }
    }
};
