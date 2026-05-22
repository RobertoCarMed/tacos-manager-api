import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhNTI0YWI5ZS00NWQxLTRlY2MtYjY5ZC02NzdhMzk1OWIwODQiLCJlbWFpbCI6InBydWViYUB0ZXN0LmNvbSIsInJvbGUiOiJDT09LIiwidGFxdWVyaWFJZCI6IjNmNzBiNzQ3LTcwZGEtNDY1YS05OTAzLWU4YmUxYzQ0ZDk0MCIsImlhdCI6MTc3OTMzOTU2NiwiZXhwIjoxNzc5NDI1OTY2fQ.s1st3JAjkwu2H1_pcB8Jx9Nok114amJjtwVMXN2vo48'
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
 * eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOGQxMzM1ZC00MTQwLTQ4NWUtYTUzZC0xNjY1ZTJmZWZiNjgiLCJlbWFpbCI6InJvc2FAdGVzdC5jb20iLCJyb2xlIjoiQ09PSyIsInRhcXVlcmlhSWQiOiJkZTVkMWZkYi1kNmFiLTRmZDYtYmFhMi1jZjJiOWMzYjQ2MzciLCJpYXQiOjE3NzkzMzg3NzMsImV4cCI6MTc3OTQyNTE3M30.5qzQuoioJ1an1bmNnNyQsSZ8UguEIgbu9n4pBpjzICw
 * 
 * eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZjNmNWMwZC02ZmY3LTQxZGUtYjk0Zi02NmJlMmVkNjQwYWEiLCJlbWFpbCI6ImFubmV0ZUB0ZXN0LmNvbSIsInJvbGUiOiJXQUlURVIiLCJ0YXF1ZXJpYUlkIjoiZGU1ZDFmZGItZDZhYi00ZmQ2LWJhYTItY2YyYjljM2I0NjM3IiwiaWF0IjoxNzc5MzM4ODExLCJleHAiOjE3Nzk0MjUyMTF9.cclP9yaKzgNXz6yj-cXPINw8rSpLeO3a7Gf2-YvkdU4
 */