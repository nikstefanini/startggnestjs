const { io } = require('socket.io-client');

// Conectar al WebSocket del servidor
const socket = io('http://localhost:8081/brackets', {
  transports: ['websocket', 'polling'],
  timeout: 5000
});

console.log('🔌 Intentando conectar al WebSocket...');

// Eventos de conexión
socket.on('connect', () => {
  console.log('✅ Conectado al WebSocket');
  console.log('📡 ID del cliente:', socket.id);
  
  // Unirse al room del torneo
  socket.emit('join-tournament', { tournamentId: 0 });
  console.log('🏆 Uniéndose al torneo ID: 0');
});

socket.on('connection-established', (data) => {
  console.log('🎉 Conexión establecida:', data);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🚨 Error de conexión:', error.message);
});

// Eventos de brackets y torneos
socket.on('match-updated', (data) => {
  console.log('🥊 Match actualizado:', data);
});

socket.on('bracket-progression', (data) => {
  console.log('📊 Progresión del bracket:', data);
});

socket.on('tournament-created', (data) => {
  console.log('🆕 Torneo creado:', data);
});

socket.on('tournament-completed', (data) => {
  console.log('🏁 Torneo completado:', data);
});

socket.on('tournament-error', (data) => {
  console.log('⚠️ Error en torneo:', data);
});

socket.on('broadcast', (data) => {
  console.log('📢 Mensaje broadcast:', data);
});

// Mantener la conexión activa
console.log('👂 Escuchando eventos... (Presiona Ctrl+C para salir)');

process.on('SIGINT', () => {
  console.log('\n👋 Cerrando conexión WebSocket...');
  socket.disconnect();
  process.exit(0);
});