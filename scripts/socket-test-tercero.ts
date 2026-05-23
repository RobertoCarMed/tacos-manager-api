import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZGI3NDc5Ni1hYTlhLTRhMzQtODA4MC03NzQ5ZTczNDEyYzQiLCJlbWFpbCI6InJvYmVydG8xQHRlc3QuY29tIiwicm9sZSI6IkNPT0siLCJ0YXF1ZXJpYUlkIjoiZGYwYzBhYTItMjBkYS00ZGQxLWIzMjktN2M3MWJhYjYxMjI2IiwiaWF0IjoxNzc5NDIxMzE2LCJleHAiOjE3Nzk1MDc3MTZ9.pZAqG11Jd2ROy9bjqfk4sqfcGDlUfeyddId17gRqKPI'
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
COOK TOKEN B
 */