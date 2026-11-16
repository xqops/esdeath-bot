const {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
} = require('discord.js');

const { playAttachment, isAudioOrVideo } = require('./tocar');

// Clique direito numa mensagem com áudio/vídeo > Apps > "Tocar na call".
// Melhor que o /tocar pra arquivo grande: o envio pelo comando costuma travar no Discord.
const data = new ContextMenuCommandBuilder()
  .setName('Tocar na call')
  .setType(ApplicationCommandType.Message)
  .setContexts(InteractionContextType.Guild);

async function execute(interaction) {
  const attachment = interaction.targetMessage.attachments.find(isAudioOrVideo);
  await playAttachment(interaction, attachment);
}

module.exports = { data, execute };
