require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Faltou configurar ${name} no arquivo .env (veja o .env.example).`);
    process.exit(1);
  }
  return value;
}

module.exports = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  // Opcional: com GUILD_ID os comandos aparecem na hora só naquele servidor.
  guildId: process.env.GUILD_ID || null,
  // MUSICA=desligada tira os comandos de música (pra hospedagem com pouca memória).
  music: process.env.MUSICA !== 'desligada',
};
