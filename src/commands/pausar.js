const { InteractionContextType, SlashCommandBuilder } = require('discord.js');

const { controllablePlayer } = require('../music/player');

const data = new SlashCommandBuilder()
  .setName('pausar')
  .setDescription('Pausa a música (use de novo pra continuar).')
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const player = await controllablePlayer(interaction);
  if (!player) return;
  const paused = player.togglePause();
  await interaction.reply(paused ? '⏸️ Pausei. Usa `/pausar` de novo pra continuar.' : '▶️ Voltei a tocar.');
}

module.exports = { data, execute };
