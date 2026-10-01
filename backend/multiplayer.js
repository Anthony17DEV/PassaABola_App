const { randomBytes } = require('node:crypto');
const rooms = {};

function generateRoomCode() {
	return randomBytes(3).toString('hex').toUpperCase();
}

function setupMultiplayer(io) {
	io.on('connection', (socket) => {
		console.log(`?? Novo jogador conectado: ${socket.id}`);

		socket.on('create_room', (playerName, callback) => {
			const roomCode = generateRoomCode();
			rooms[roomCode] = {
				players: [{ id: socket.id, name: playerName, score: 0 }],
				state: 'lobby',
			};

			socket.join(roomCode);
			console.log(`?? Sala ${roomCode} criada por ${playerName}`);

			callback({ success: true, roomCode });
		});

		socket.on('join_room', ({ roomCode, playerName }, callback) => {
			const room = rooms[roomCode];

			if (!room) {
				return callback({ success: false, message: 'Sala não encontrada. O código tá certo?' });
			}
			if (room.state !== 'lobby') {
				return callback({ success: false, message: 'O jogo já começou nessa sala!' });
			}
			if (room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase())) {
				return callback({ success: false, message: 'Já tem alguém com esse nome na sala.' });
			}

			room.players.push({ id: socket.id, name: playerName, score: 0 });
			socket.join(roomCode);

			io.to(roomCode).emit('room_updated', room);

			callback({ success: true, room });
		});

		socket.on('disconnect', () => {
			console.log(`? Jogador desconectou: ${socket.id}`);
			for (const code in rooms) {
				const room = rooms[code];
				const playerIndex = room.players.findIndex(p => p.id === socket.id);

				if (playerIndex !== -1) {
					room.players.splice(playerIndex, 1);

					if (room.players.length === 0) {
						delete rooms[code];
						console.log(`??? Sala ${code} destruída (vazia).`);
					} else {
						io.to(code).emit('room_updated', room);
					}
					break;
				}
			}
		});
	});
}

module.exports = { setupMultiplayer };