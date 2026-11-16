const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');

const { GuildPlayer } = require('../music/player');

const data = new SlashCommandBuilder()
  .setName('fila')
  .setDescription('Mostra a música tocando agora e as próximas.')
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const player = GuildPlayer.get(interaction.guildId);
  await interaction.reply({
    content: player ? player.queueText(20) : 'A fila está vazia.',
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
