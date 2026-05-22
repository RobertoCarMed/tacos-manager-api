import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YWVlYTM5MS01NzVjLTQzMTUtODkzNy0yNDcwZDdjYzEzNjMiLCJlbWFpbCI6Imp1YW5AdGVzdC5jb20iLCJyb2xlIjoiV0FJVEVSIiwidGFxdWVyaWFJZCI6ImRmMGMwYWEyLTIwZGEtNGRkMS1iMzI5LTdjNzFiYWI2MTIyNiIsImlhdCI6MTc3OTMzOTI4NywiZXhwIjoxNzc5NDI1Njg3fQ.VV9WC9vR0w7lZ8Zo4D5IvMKHYn5msXWvzfhnGuwRSyE'
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