const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* =========================================================
   PERSISTENCE (simple JSON files — no external DB required)
   ========================================================= */
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LEADERBOARD_FILE)) fs.writeFileSync(LEADERBOARD_FILE, '{}');
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function ensurePlayer(leaderboard, name) {
    if (!leaderboard[name]) {
        leaderboard[name] = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, bestTimeMs: null };
    }
    return leaderboard[name];
}

function recordGame({ mode, playerX, playerO, result, elapsedMs }) {
    const leaderboard = loadJSON(LEADERBOARD_FILE) || {};
    const history = loadJSON(HISTORY_FILE) || [];

    [playerX, playerO].forEach(n => ensurePlayer(leaderboard, n));

    const applyResult = (name, outcome) => {
        const p = leaderboard[name];
        p.gamesPlayed++;
        if (outcome === 'win') {
            p.wins++;
            if (p.bestTimeMs === null || elapsedMs < p.bestTimeMs) p.bestTimeMs = elapsedMs;
        } else if (outcome === 'loss') {
            p.losses++;
        } else {
            p.draws++;
        }
    };

    if (result === 'draw') {
        applyResult(playerX, 'draw');
        applyResult(playerO, 'draw');
    } else if (result === 'X') {
        applyResult(playerX, 'win');
        applyResult(playerO, 'loss');
    } else if (result === 'O') {
        applyResult(playerO, 'win');
        applyResult(playerX, 'loss');
    }
    saveJSON(LEADERBOARD_FILE, leaderboard);

    const winnerName = result === 'draw' ? null : (result === 'X' ? playerX : playerO);
    const entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        mode, playerX, playerO, result, winnerName,
        elapsedMs,
        timestamp: new Date().toISOString()
    };
    history.unshift(entry);
    saveJSON(HISTORY_FILE, history.slice(0, 1000));
    return entry;
}

/* =========================================================
   REST API
   ========================================================= */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leaderboard', (req, res) => {
    res.json(loadJSON(LEADERBOARD_FILE) || {});
});

app.get('/api/history', (req, res) => {
    res.json(loadJSON(HISTORY_FILE) || []);
});

// Record a same-device (local) game result
app.post('/api/record-local', (req, res) => {
    const { playerX, playerO, result, elapsedMs } = req.body;
    if (!playerX || !playerO || !result) {
        return res.status(400).json({ error: 'missing fields' });
    }
    const entry = recordGame({ mode: 'local', playerX, playerO, result, elapsedMs: elapsedMs || 0 });
    res.json(entry);
});

/* =========================================================
   ONLINE MULTIPLAYER (Socket.io) — two different devices
   ========================================================= */
const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];
function checkWinner(board) {
    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(c => c)) return 'draw';
    return null;
}

const rooms = {}; // code -> { board, turn, players: {X:{id,name}, O:{id,name}}, startTime, gameOver }

function genRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).slice(2, 6).toUpperCase();
    } while (rooms[code]);
    return code;
}

io.on('connection', (socket) => {
    socket.on('create-room', ({ name }) => {
        const code = genRoomCode();
        rooms[code] = {
            board: Array(9).fill(''),
            turn: 'O',
            players: { O: { id: socket.id, name } },
            startTime: null,
            gameOver: false
        };
        socket.join(code);
        socket.data.room = code;
        socket.data.symbol = 'O';
        socket.emit('room-created', { code, symbol: 'O' });
    });

    socket.on('join-room', ({ name, code }) => {
        code = (code || '').toUpperCase();
        const room = rooms[code];
        if (!room) return socket.emit('join-error', { message: 'Room not found' });
        if (room.players.X) return socket.emit('join-error', { message: 'Room is full' });

        room.players.X = { id: socket.id, name };
        socket.join(code);
        socket.data.room = code;
        socket.data.symbol = 'X';
        room.startTime = Date.now();

        io.to(code).emit('game-start', {
            board: room.board,
            turn: room.turn,
            names: { X: room.players.X.name, O: room.players.O.name },
            startTime: room.startTime
        });
    });

    socket.on('move', ({ index }) => {
        const code = socket.data.room;
        const room = rooms[code];
        if (!room || room.gameOver || !room.players.X) return;
        const symbol = socket.data.symbol;
        if (symbol !== room.turn) return;
        if (room.board[index]) return;

        room.board[index] = symbol;
        room.turn = symbol === 'X' ? 'O' : 'X';

        const result = checkWinner(room.board);
        io.to(code).emit('board-update', { board: room.board, turn: room.turn });

        if (result) {
            room.gameOver = true;
            const elapsedMs = Date.now() - room.startTime;
            const entry = recordGame({
                mode: 'online',
                playerX: room.players.X.name,
                playerO: room.players.O.name,
                result,
                elapsedMs
            });
            io.to(code).emit('game-over', { result, elapsedMs, entry });
        }
    });

    socket.on('restart-room', () => {
        const code = socket.data.room;
        const room = rooms[code];
        if (!room || !room.players.X) return;
        room.board = Array(9).fill('');
        room.turn = 'O';
        room.gameOver = false;
        room.startTime = Date.now();
        io.to(code).emit('game-start', {
            board: room.board,
            turn: room.turn,
            names: { X: room.players.X.name, O: room.players.O.name },
            startTime: room.startTime
        });
    });

    socket.on('disconnect', () => {
        const code = socket.data.room;
        if (code && rooms[code]) {
            socket.to(code).emit('opponent-left');
            delete rooms[code];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Tic Tac Toe server running on http://localhost:${PORT}`));
