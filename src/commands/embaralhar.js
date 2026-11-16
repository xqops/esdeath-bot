const { InteractionContextType, SlashCommandBuilder } = require('discord.js');

const { controllablePlayer } = require('../music/player');

const data = new SlashCommandBuilder()
  .setName('embaralhar')
  .setDescription('Embaralha as músicas da fila.')
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const player = await controllablePlayer(interaction);
  if (!player) return;
  player.shuffle();
  await interaction.reply(`🔀 Embaralhei ${player.queue.length} músicas da fila.`);
}

module.exports = { data, execute };
