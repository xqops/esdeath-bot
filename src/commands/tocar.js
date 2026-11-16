const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');

const { enqueue } = require('./play');

const data = new SlashCommandBuilder()
  .setName('tocar')
  .setDescription('Toca um arquivo de áudio ou o som de um vídeo na call em que você está.')
  .setContexts(InteractionContextType.Guild)
  .addAttachmentOption((option) => option
    .setName('arquivo')
    .setDescription('Áudio (mp3...) ou vídeo (mp4...); do vídeo só toca o som')
    .setRequired(true));

// Vídeo também vale: o ffmpeg ignora a imagem e toca só o som.
function isAudioOrVideo(attachment) {
  return /^(audio|video)\//.test(attachment.contentType ?? '')
    || /\.(mp3|ogg|wav|m4a|opus|flac|mp4|mov|webm|mkv|avi)$/i.test(attachment.name);
}

// Usado também pelo menu "Tocar na call": põe o anexo na fila de música.
async function playAttachment(interaction, attachment) {
  if (!attachment || !isAudioOrVideo(attachment)) {
    await interaction.reply({
      content: 'Isso não parece ser um áudio ou vídeo. Manda um mp3 ou mp4.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await enqueue(interaction, async () => ({
    tracks: [{
      title: attachment.name,
      url: attachment.url,
      source: 'direct',
      requestedBy: interaction.member.displayName,
    }],
  }));
}

async function execute(interaction) {
  await playAttachment(interaction, interaction.options.getAttachment('arquivo', true));
}

module.exports = { data, execute, playAttachment, isAudioOrVideo };
