const fs = require('fs');
const path = require('path');
const { randomBytes } = require('node:crypto');

function carregarBaralhos() {
	try {
		const blackCsv = fs.readFileSync(path.join(__dirname, 'black-cards-pt-br.csv'), 'utf-8');
		const whiteCsv = fs.readFileSync(path.join(__dirname, 'white-cards-pt-br.csv'), 'utf-8');

		const parseCsv = (csv) => csv.split('\n').slice(1).map(linha => {
			const partes = linha.split(';');
			return partes[1] ? partes[1].trim() : null;
		}).filter(x => x);

		return {
			basePretas: parseCsv(blackCsv),
			baseBrancas: parseCsv(whiteCsv)
		};
	} catch (e) {
		console.error("Erro ao carregar os ficheiros CSV. Confirma se os colocaste na pasta backend.", e);
		return { basePretas: ['Falha ao carregar a carta ___'], baseBrancas: ['Erro de carregamento'] };
	}
}

const { basePretas, baseBrancas } = carregarBaralhos();

function baralhar(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

const salas = {};
const PONTOS_MAXIMOS = 20;
const TAMANHO_MAO = 6;

function gerarCodigo() {
	return randomBytes(3).toString('hex').toUpperCase();
}

function setupMultiplayer(io) {
	io.on('connection', (socket) => {
		console.log(`?? Novo jogador ligado: ${socket.id}`);

		socket.on('create_room', (playerName, callback) => {
			const code = gerarCodigo();
			salas[code] = {
				code,
				state: 'lobby',
				players: [{ id: socket.id, name: playerName, score: 0, hand: [], hasPlayed: false }],
				czarIndex: 0,
				blackDeck: [],
				whiteDeck: [],
				currentBlackCard: null,
				cardsOnTable: [],
				winningCard: null,
				winnerName: null
			};
			socket.join(code);
			callback({ success: true, roomCode: code });
		});

		socket.on('join_room', ({ roomCode, playerName }, callback) => {
			const room = salas[roomCode];
			if (!room) return callback({ success: false, message: 'Sala não encontrada.' });
			if (room.state !== 'lobby') return callback({ success: false, message: 'O jogo já começou nesta sala!' });

			room.players.push({ id: socket.id, name: playerName, score: 0, hand: [], hasPlayed: false });
			socket.join(roomCode);
			io.to(roomCode).emit('room_updated', room);
			callback({ success: true, room });
		});

		socket.on('start_game', (roomCode) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'lobby') return;

			room.blackDeck = baralhar(basePretas);
			room.whiteDeck = baralhar(baseBrancas);
			room.czarIndex = Math.floor(Math.random() * room.players.length);
			room.currentBlackCard = room.blackDeck.pop();
			room.cardsOnTable = [];
			room.state = 'playing';

			room.players.forEach(p => {
				p.score = 0;
				p.hand = [];
				p.hasPlayed = false;
				for (let i = 0; i < TAMANHO_MAO; i++) p.hand.push(room.whiteDeck.pop());
			});

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('discard_white', ({ roomCode, cardText }) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'playing') return;
			const player = room.players.find(p => p.id === socket.id);

			if (!player || player.hasPlayed) return;

			player.hand = player.hand.filter(c => c !== cardText);
			if (room.whiteDeck.length === 0) room.whiteDeck = baralhar(baseBrancas);
			player.hand.push(room.whiteDeck.pop());

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('discard_black', (roomCode) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'playing') return;
			const czar = room.players[room.czarIndex];

			if (czar.id !== socket.id) return;

			if (room.blackDeck.length === 0) room.blackDeck = baralhar(basePretas);
			room.currentBlackCard = room.blackDeck.pop();

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('play_card', ({ roomCode, cardText }) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'playing') return;
			const player = room.players.find(p => p.id === socket.id);
			const czar = room.players[room.czarIndex];

			if (!player || player.id === czar.id || player.hasPlayed) return;

			player.hand = player.hand.filter(c => c !== cardText);
			player.hasPlayed = true;
			room.cardsOnTable.push({ playerId: player.id, card: cardText });

			if (room.cardsOnTable.length === room.players.length - 1) {
				room.state = 'judging';
				room.cardsOnTable = baralhar(room.cardsOnTable);
			}

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('choose_winner', ({ roomCode, cardText }) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'judging') return;
			const czar = room.players[room.czarIndex];
			if (czar.id !== socket.id) return;

			const winningEntry = room.cardsOnTable.find(c => c.card === cardText);
			if (!winningEntry) return;

			const winner = room.players.find(p => p.id === winningEntry.playerId);
			if (winner) winner.score += 1;

			room.winningCard = cardText;
			room.winnerName = winner ? winner.name : 'Desconhecido';

			if (winner && winner.score >= PONTOS_MAXIMOS) {
				room.state = 'game_over';
			} else {
				room.state = 'round_end';
			}

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('next_round', (roomCode) => {
			const room = salas[roomCode];
			if (!room || room.state !== 'round_end') return;

			room.czarIndex = (room.czarIndex + 1) % room.players.length;

			if (room.blackDeck.length === 0) room.blackDeck = baralhar(basePretas);
			room.currentBlackCard = room.blackDeck.pop();
			room.cardsOnTable = [];
			room.winningCard = null;
			room.winnerName = null;
			room.state = 'playing';

			room.players.forEach(p => {
				p.hasPlayed = false;
				while (p.hand.length < TAMANHO_MAO) {
					if (room.whiteDeck.length === 0) room.whiteDeck = baralhar(baseBrancas);
					p.hand.push(room.whiteDeck.pop());
				}
			});

			io.to(roomCode).emit('room_updated', room);
		});

		socket.on('disconnect', () => {
			for (const code in salas) {
				const room = salas[code];
				const pIndex = room.players.findIndex(p => p.id === socket.id);
				if (pIndex !== -1) {
					room.players.splice(pIndex, 1);
					if (room.players.length === 0) {
						delete salas[code];
					} else {
						if (room.czarIndex >= room.players.length) {
							room.czarIndex = 0;
						}
						io.to(code).emit('room_updated', room);
					}
					break;
				}
			}
		});
	});
}

module.exports = { setupMultiplayer };