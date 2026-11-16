const { InteractionContextType, SlashCommandBuilder } = require('discord.js');

const { controllablePlayer } = require('../music/player');

const data = new SlashCommandBuilder()
  .setName('parar')
  .setDescription('Para a música, limpa a fila e tira o bot da call.')
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const player = await controllablePlayer(interaction);
  if (!player) return;
  player.stop();
  await interaction.reply('⏹️ Parei a música e saí da call.');
}

module.exports = { data, execute };
