import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOGQxMzM1ZC00MTQwLTQ4NWUtYTUzZC0xNjY1ZTJmZWZiNjgiLCJlbWFpbCI6InJvc2FAdGVzdC5jb20iLCJyb2xlIjoiQ09PSyIsInRhcXVlcmlhSWQiOiJkZTVkMWZkYi1kNmFiLTRmZDYtYmFhMi1jZjJiOWMzYjQ2MzciLCJpYXQiOjE3Nzk0MjA5NzAsImV4cCI6MTc3OTUwNzM3MH0.lL8GtPAofrPQTFDMLOtTCb01q1sKqr5r0ERqIQeOW98'
    },
});

socket.on('connect', () => {
  console.log('CONNECTED');
  console.log(socket.id);
  setTimeout(() => {
    console.log('EMITTING');
    socket.emit('join-taqueria');
  }, 200);
});


socket.on('disconnect', reason => {
  console.log('DISCONNECTED', reason);
});

socket.on('connect_error', error => {
  console.log('ERROR');
  console.log(error.message);
});


/**
COOK TOKEN A
 */