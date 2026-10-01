import { io } from 'socket.io-client';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || 'http://localhost:3000';

export const socket = io(apiUrl, {
	autoConnect: false,
});