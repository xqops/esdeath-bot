const { InteractionContextType, SlashCommandBuilder } = require('discord.js');

const { controllablePlayer } = require('../music/player');

const data = new SlashCommandBuilder()
  .setName('pular')
  .setDescription('Pula pra próxima música da fila.')
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const player = await controllablePlayer(interaction);
  if (!player) return;
  const title = player.current?.title;
  player.skip();
  await interaction.reply(title ? `⏭️ Pulei **${title}**.` : 'Não tem música tocando agora.');
}

module.exports = { data, execute };
