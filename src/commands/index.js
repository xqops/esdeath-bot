const { music } = require('../config');
const legenda = require('./legenda');
const legendarMensagem = require('./legendar-mensagem');

// Os comandos de música só são carregados quando a música está ligada.
const musicCommands = music
  ? ['play', 'tocar', 'tocar-mensagem', 'pular', 'pausar', 'fila', 'embaralhar', 'parar']
    .map((name) => require(`./${name}`))
  : [];

module.exports = [legenda, legendarMensagem, ...musicCommands];
