const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('Manage reaction roles')
        .addSubcommand(sub => sub.setName('create').setDescription('Create a reaction role message')
            .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
            .addStringOption(o => o.setName('description').setDescription('Embed description').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').addChannelTypes(ChannelType.GuildText))
            .addStringOption(o => o.setName('roles').setDescription('Roles: roleId:emoji,roleId:emoji').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all reaction roles'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete a reaction role')
            .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))),
    cooldown: 5000,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const title = interaction.options.getString('title');
            const desc = interaction.options.getString('description');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const rolesStr = interaction.options.getString('roles');

            const rolePairs = rolesStr.split(',').map(p => {
                const [roleId, emoji] = p.trim().split(':');
                return { roleId: roleId?.trim(), emoji: emoji?.trim() };
            }).filter(r => r.roleId && r.emoji);

            if (rolePairs.length === 0) return interaction.reply({ content: 'Invalid format! Use: roleId:emoji,roleId:emoji', ephemeral: true });
            if (rolePairs.length > 25) return interaction.reply({ content: 'Max 25 roles!', ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(title)
                .setDescription(desc + '\n\n' + rolePairs.map(r => `${r.emoji} — <@&${r.roleId}>`).join('\n'))
                .setFooter({ text: `ID: pending` })
                .setTimestamp();

            const msg = await channel.send({ embeds: [embed] });
            for (const r of rolePairs) {
                try { await msg.react(r.emoji); } catch (e) {}
            }
            embed.setFooter({ text: `ID: ${msg.id}` });
            await msg.edit({ embeds: [embed] });

            if (!interaction.client.reactionRoles) interaction.client.reactionRoles = new Map();
            interaction.client.reactionRoles.set(msg.id, {
                guildId: interaction.guild.id,
                channelId: channel.id,
                roles: rolePairs
            });

            await interaction.reply({ content: `Reaction roles created in ${channel}!`, ephemeral: true });
        }

        if (sub === 'list') {
            if (!interaction.client.reactionRoles || interaction.client.reactionRoles.size === 0) {
                return interaction.reply({ content: 'No reaction roles configured!', ephemeral: true });
            }
            const list = [...interaction.client.reactionRoles.entries()]
                .filter(([_, v]) => v.guildId === interaction.guild.id)
                .map(([id, v]) => `• \`${id}\` — ${v.roles.length} roles in <#${v.channelId}>`)
                .join('\n');
            await interaction.reply({ content: list || 'None in this server.', ephemeral: true });
        }

        if (sub === 'delete') {
            const id = interaction.options.getString('message_id');
            if (!interaction.client.reactionRoles?.has(id)) return interaction.reply({ content: 'Not found!', ephemeral: true });
            interaction.client.reactionRoles.delete(id);
            await interaction.reply({ content: 'Reaction role deleted!', ephemeral: true });
        }
    }
};
