const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');

const { spawnFfmpeg } = require('../media/ffmpeg');
const { spawnAudioDownload, describeYtDlpError } = require('./yt-dlp');

// Converte pra Opus, o formato de voz do Discord.
const OPUS_OUTPUT = ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1'];
const CONNECT_TIMEOUT_MS = 20_000;
const LEAVE_AFTER_QUEUE_MS = 60_000;
const LEAVE_WHEN_ALONE_MS = 30_000;
const BUTTON_PREFIX = 'musica:';
const COLOR = 0xb3241b;

/** @type {Map<string, GuildPlayer>} */
const players = new Map();

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function trackLine(track) {
  const duration = formatDuration(track.durationSec);
  return `${track.title}${duration ? ` (${duration})` : ''}`;
}

class GuildPlayer {
  constructor(connection, voiceChannel, textChannel) {
    this.connection = connection;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.guildId = voiceChannel.guild.id;
    /** @type {import('./resolve').Track[]} */
    this.queue = [];
    this.current = null;
    this.processes = [];
    this.panel = null;
    this.leaveTimer = null;
    this.aloneTimer = null;
    this.stopped = false;

    this.audio = createAudioPlayer();
    connection.subscribe(this.audio);
    this.audio.on(AudioPlayerStatus.Idle, () => this.playNext());
    this.audio.on('error', (error) => console.error('[música]', error.message));

    connection.on(VoiceConnectionStatus.Destroyed, () => this.cleanup());
    // Se tirarem o bot da call, só sai (em vez de ficar tentando reconectar).
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.stop();
      }
    });
  }

  static get(guildId) {
    return players.get(guildId);
  }

  // Entra na call (ou reaproveita o player que já está lá).
  static async join(voiceChannel, textChannel) {
    const existing = players.get(voiceChannel.guild.id);
    if (existing) {
      existing.textChannel = textChannel;
      return existing;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, CONNECT_TIMEOUT_MS);
    } catch {
      connection.destroy();
      throw new Error('Não consegui entrar na call.');
    }

    const player = new GuildPlayer(connection, voiceChannel, textChannel);
    players.set(player.guildId, player);
    return player;
  }

  get paused() {
    return this.audio.state.status === AudioPlayerStatus.Paused;
  }

  add(tracks) {
    this.queue.push(...tracks);
    clearTimeout(this.leaveTimer);
    if (!this.current) this.playNext();
    else this.refreshPanel();
  }

  playNext() {
    if (this.stopped) return;
    this.killProcesses();
    clearTimeout(this.leaveTimer);

    const track = this.queue.shift() ?? null;
    this.current = track;
    if (!track) {
      this.refreshPanel({ resend: true });
      this.leaveTimer = setTimeout(() => this.stop(), LEAVE_AFTER_QUEUE_MS);
      return;
    }

    console.log(`[música] tocando: ${track.title}`);
    this.audio.play(createAudioResource(this.openStream(track), { inputType: StreamType.OggOpus }));
    this.refreshPanel({ resend: true });
  }

  openStream(track) {
    if (track.source === 'direct') {
      const ffmpeg = spawnFfmpeg([
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-i', track.url, ...OPUS_OUTPUT,
      ]);
      ffmpeg.stderr.on('data', (chunk) => console.error(`[ffmpeg] ${chunk}`));
      ffmpeg.on('close', (code) => {
        if (code && !ffmpeg.killed && this.current === track) this.warn(track, 'não consegui ler esse arquivo.');
      });
      this.processes.push(ffmpeg);
      return ffmpeg.stdout;
    }

    // yt-dlp baixa o áudio e o ffmpeg converte ao mesmo tempo.
    const download = spawnAudioDownload(track.url);
    const ffmpeg = spawnFfmpeg(['-i', 'pipe:0', ...OPUS_OUTPUT], { readStdin: true });
    download.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdin.on('error', () => {}); // fecha sozinho quando pula a música

    let stderr = '';
    download.stderr.on('data', (chunk) => { stderr += chunk; });
    download.on('close', (code) => {
      if (code && !download.killed && this.current === track) {
        console.error(`[música] yt-dlp falhou em "${track.title}": ${stderr.trim()}`);
        this.warn(track, describeYtDlpError(stderr));
      }
    });

    this.processes.push(download, ffmpeg);
    return ffmpeg.stdout;
  }

  warn(track, reason) {
    this.textChannel.send(`⚠️ Não consegui tocar **${track.title}**: ${reason}`).catch(() => {});
  }

  killProcesses() {
    for (const proc of this.processes) proc.kill();
    this.processes = [];
  }

  skip() {
    if (!this.current) return false;
    this.audio.stop(); // vai pra Idle, que chama a próxima
    return true;
  }

  togglePause() {
    if (this.paused) this.audio.unpause();
    else this.audio.pause();
    this.refreshPanel();
    return this.paused;
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.refreshPanel();
  }

  stop() {
    this.stopped = true;
    this.queue = [];
    this.audio.stop(true);
    if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) this.connection.destroy();
  }

  cleanup() {
    this.stopped = true;
    this.current = null;
    this.killProcesses();
    clearTimeout(this.leaveTimer);
    clearTimeout(this.aloneTimer);
    players.delete(this.guildId);
    this.panel?.edit({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription('⏹️ Saí da call.')], components: [] })
      .catch(() => {});
    this.panel = null;
  }

  // Sai da call se ficar sem ninguém (só bots) por um tempo.
  checkAlone() {
    const humans = this.voiceChannel.members.filter((member) => !member.user.bot).size;
    clearTimeout(this.aloneTimer);
    if (!humans) this.aloneTimer = setTimeout(() => this.stop(), LEAVE_WHEN_ALONE_MS);
  }

  queueText(limit = 10) {
    if (!this.current && !this.queue.length) return 'A fila está vazia.';
    const lines = [];
    if (this.current) lines.push(`**Tocando agora:** ${trackLine(this.current)}`);
    if (this.queue.length) {
      lines.push('', '**Próximas:**');
      this.queue.slice(0, limit).forEach((track, i) => lines.push(`${i + 1}. ${trackLine(track)}`));
      if (this.queue.length > limit) lines.push(`… e mais ${this.queue.length - limit}.`);
    }
    return lines.join('\n');
  }

  panelMessage() {
    if (!this.current) {
      return {
        embeds: [new EmbedBuilder().setColor(COLOR)
          .setDescription('✅ A fila acabou. Saio da call em 1 minuto se ninguém pedir mais nada.')],
        components: [],
      };
    }

    const track = this.current;
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: this.paused ? '⏸️ Pausado' : '🎶 Tocando agora' })
      .setTitle(track.title.slice(0, 256))
      .addFields(
        { name: 'Duração', value: formatDuration(track.durationSec) ?? '—', inline: true },
        { name: 'Pedido por', value: track.requestedBy, inline: true },
        { name: 'Na fila', value: String(this.queue.length), inline: true },
      );
    if (/^https?:\/\//.test(track.pageUrl ?? '')) embed.setURL(track.pageUrl);

    const button = (action, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder()
      .setCustomId(BUTTON_PREFIX + action).setEmoji(emoji).setStyle(style);
    const row = new ActionRowBuilder().addComponents(
      button('pausar', this.paused ? '▶️' : '⏸️'),
      button('pular', '⏭️'),
      button('embaralhar', '🔀'),
      button('fila', '📜'),
      button('parar', '⏹️', ButtonStyle.Danger),
    );
    return { embeds: [embed], components: [row] };
  }

  // Mostra o painel. Em música nova manda um painel novo (fica embaixo no chat).
  async refreshPanel({ resend = false } = {}) {
    try {
      if (this.panel && !resend) {
        await this.panel.edit(this.panelMessage());
        return;
      }
      const old = this.panel;
      this.panel = await this.textChannel.send(this.panelMessage());
      await old?.delete().catch(() => {});
    } catch (error) {
      console.error('[música] painel:', error.message);
    }
  }
}

/**
 * Confere se a pessoa está numa call em que o bot pode entrar e falar.
 * @returns {string | null} o problema, ou null se está tudo certo
 */
function voiceProblem(interaction) {
  const channel = interaction.member.voice.channel;
  if (!channel) return 'Entra numa call primeiro, aí eu vou lá tocar 🎧';
  if (!channel.permissionsFor(interaction.guild.members.me)
    .has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return `Não tenho permissão pra entrar e falar em ${channel}.`;
  }
  const player = GuildPlayer.get(interaction.guildId);
  if (player && player.voiceChannel.id !== channel.id) {
    return `Já estou tocando em ${player.voiceChannel}. Entra lá pra pedir música.`;
  }
  return null;
}

/**
 * Pra /pular, /pausar etc.: devolve o player se a pessoa pode controlar, senão responde o motivo.
 */
async function controllablePlayer(interaction) {
  const player = GuildPlayer.get(interaction.guildId);
  let problem = null;
  if (!player) problem = 'Não estou tocando nada agora.';
  else if (interaction.member.voice.channelId !== player.voiceChannel.id) {
    problem = `Entra em ${player.voiceChannel} pra controlar a música.`;
  }
  if (problem) {
    await interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });
    return null;
  }
  return player;
}

// Botões do painel.
async function handleButton(interaction) {
  const player = await controllablePlayer(interaction);
  if (!player) return;

  switch (interaction.customId.slice(BUTTON_PREFIX.length)) {
    case 'pausar':
      player.togglePause();
      await interaction.deferUpdate();
      break;
    case 'pular':
      await interaction.reply(`⏭️ ${interaction.member.displayName} pulou **${player.current?.title ?? 'a música'}**.`);
      player.skip();
      break;
    case 'embaralhar':
      player.shuffle();
      await interaction.reply(`🔀 ${interaction.member.displayName} embaralhou a fila.`);
      break;
    case 'fila':
      await interaction.reply({ content: player.queueText(), flags: MessageFlags.Ephemeral });
      break;
    case 'parar':
      player.stop();
      await interaction.reply(`⏹️ ${interaction.member.displayName} parou a música.`);
      break;
    default:
      await interaction.deferUpdate();
  }
}

module.exports = { GuildPlayer, voiceProblem, controllablePlayer, handleButton, BUTTON_PREFIX };
