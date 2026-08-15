const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupstats')
        .setDescription('Create live server stats channels with emojis')
        .addChannelOption(option => option.setName('category').setDescription('Category to create stats in').setRequired(true)),
    cooldown: 30,
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permission!', ephemeral: true });
        }

        const category = interaction.options.getChannel('category');

        if (category.type !== 4) {
            return interaction.reply({ content: 'Please select a category channel!', ephemeral: true });
        }

        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'I need **Manage Channels** permission! Give me this permission and try again.', ephemeral: true });
        }

        await interaction.deferReply();

        const guild = interaction.guild;
        await guild.members.fetch();

        const stats = getStats(guild);

        const channelsToCreate = [
            { name: `🚀 Boosts: ${stats.boosts}` },
            { name: `💰 Coins: 2.05M` },
            { name: `👥 Total Members: ${stats.totalMembers}` },
            { name: `😎 Human Members: ${stats.humans}` },
            { name: `🤖 Bots: ${stats.bots}` },
            { name: `🟢 Online Members: ${stats.online}` },
            { name: `⚫ Offline Members: ${stats.offline}` },
            { name: `📁 Channels: ${stats.channels}` },
            { name: `🎨 Roles: ${stats.roles}` },
            { name: `🔊 Voice Members: ${stats.voiceMembers}` }
        ];

        let created = 0;
        let errors = [];

        for (const stat of channelsToCreate) {
            try {
                await guild.channels.create({
                    name: stat.name,
                    type: 2,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: ['Connect']
                        }
                    ]
                });
                created++;
            } catch (error) {
                errors.push(`${stat.name}: ${error.message}`);
                console.error(`Failed to create ${stat.name}:`, error.message);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(created > 0 ? '#00FF00' : '#FF0000')
            .setTitle(created > 0 ? '✅ Live Stats Created!' : '❌ Failed to Create Stats')
            .setDescription(`Created ${created}/10 channels in ${category}`)
            .setTimestamp();

        if (errors.length > 0) {
            embed.addFields({ name: 'Errors', value: errors.slice(0, 5).join('\n') });
        }

        interaction.editReply({ embeds: [embed] });
    }
};

function getStats(guild) {
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

    return { totalMembers, humans, bots, online, offline, channels, roles, voiceMembers, boosts };
}
