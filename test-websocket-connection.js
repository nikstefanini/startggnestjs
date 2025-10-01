const { io } = require('socket.io-client');

console.log('🔌 Probando conexión WebSocket...');

// Probar conexión con namespace /brackets
const socket = io('http://localhost:8081/brackets', {
  transports: ['websocket', 'polling'],
  timeout: 5000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ WebSocket conectado exitosamente');
  console.log('📡 Socket ID:', socket.id);
  console.log('🌐 Namespace:', socket.nsp.name);
  
  // Probar unirse a un torneo
  socket.emit('join:tournament', { 
    tournamentId: 'cmfyn99g60001hgpvby13ie8z',
    userId: 'test-user' 
  });
  
  console.log('📤 Enviado evento join:tournament');
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.error('🔍 Detalles:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Desconectado:', reason);
});

socket.on('tournament:joined', (data) => {
  console.log('🎯 Evento recibido - tournament:joined:', data);
});

socket.on('error', (error) => {
  console.error('⚠️ Error del socket:', error);
});

// Cerrar después de 10 segundos
setTimeout(() => {
  console.log('⏰ Cerrando conexión de prueba...');
  socket.disconnect();
  process.exit(0);
}, 10000);