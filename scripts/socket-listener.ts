import { io } from 'socket.io-client';

const token = process.argv[2];

if (!token) {
  throw new Error('JWT requerido');
}

const socket = io('http://localhost:3000', {
  auth: {
    token,
  },
});

socket.on('connect', () => {
  console.log('CONNECTED');
  console.log(socket.id);
});

socket.on('disconnect', reason => {
  console.log('DISCONNECTED', reason);
});

socket.on('connect_error', error => {
  console.log('ERROR');
  console.log(error.message);
});

socket.onAny((event, payload) => {
  console.log('\n====================');
  console.log('EVENT:', event);
  console.dir(payload, { depth: null });
  console.log('====================\n');
});