/* =========================================================
   CONFETTI CELEBRATION
   ========================================================= */
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let confettiPieces = [];
let confettiRAF = null;
const CONFETTI_COLORS = ['#78BEC5', '#DB695A', '#ECAF4E', '#ffffff'];

function celebrate() {
    confettiPieces = [];
    for (let i = 0; i < 140; i++) {
        confettiPieces.push({
            x: Math.random() * confettiCanvas.width,
            y: -20 - Math.random() * confettiCanvas.height * 0.5,
            r: 4 + Math.random() * 6,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            speedY: 2 + Math.random() * 3,
            speedX: -1.5 + Math.random() * 3,
            rotation: Math.random() * 360,
            spin: -6 + Math.random() * 12
        });
    }
    const start = Date.now();
    cancelAnimationFrame(confettiRAF);
    function tick() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiPieces.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.rotation += p.spin;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
            ctx.restore();
        });
        if (Date.now() - start < 3000) {
            confettiRAF = requestAnimationFrame(tick);
        } else {
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }
    tick();
}

/* =========================================================
   TIME / DATE HELPERS
   ========================================================= */
function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
}
function formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' \u2022 ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function dateKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* =========================================================
   USER / SESSION (who's logged in on this browser)
   ========================================================= */
const CURRENT_USER_KEY = 'ttt_currentUser';
const KNOWN_USERS_KEY = 'ttt_knownUsers';
function getCurrentUser() { return localStorage.getItem(CURRENT_USER_KEY); }
function setCurrentUser(name) {
    localStorage.setItem(CURRENT_USER_KEY, name);
    const known = new Set(JSON.parse(localStorage.getItem(KNOWN_USERS_KEY) || '[]'));
    known.add(name);
    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([...known]));
}
function getKnownUsers() {
    return JSON.parse(localStorage.getItem(KNOWN_USERS_KEY) || '[]');
}
function clearCurrentUser() { localStorage.removeItem(CURRENT_USER_KEY); }

/* =========================================================
   NAVIGATION
   ========================================================= */
const pages = ['login', 'game', 'leaderboard', 'calendar'];
let navHistory = [];
let navIndex = -1;

const navbar = document.getElementById('navbar');
const navUser = document.getElementById('nav-user');
const navBackBtn = document.getElementById('nav-back');
const navForwardBtn = document.getElementById('nav-forward');
const navLinks = document.querySelectorAll('.nav-link');

function showPage(pageName, addToHistory = true) {
    pages.forEach(p => {
        document.getElementById(p + '-page').classList.toggle('hidden', p !== pageName);
    });
    navLinks.forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageName));

    if (addToHistory) {
        navHistory = navHistory.slice(0, navIndex + 1);
        navHistory.push(pageName);
        navIndex = navHistory.length - 1;
    }
    updateNavButtons();

    if (pageName === 'leaderboard') renderLeaderboard();
    if (pageName === 'calendar') renderCalendarPage();
}
function updateNavButtons() {
    navBackBtn.disabled = navIndex <= 0;
    navForwardBtn.disabled = navIndex >= navHistory.length - 1;
}
navBackBtn.addEventListener('click', () => {
    if (navIndex > 0) { navIndex--; showPage(navHistory[navIndex], false); }
});
navForwardBtn.addEventListener('click', () => {
    if (navIndex < navHistory.length - 1) { navIndex++; showPage(navHistory[navIndex], false); }
});
navLinks.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));

/* =========================================================
   LOGIN / LOGOUT
   ========================================================= */
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const knownUsersDiv = document.getElementById('known-users');
const logoutBtn = document.getElementById('logout-btn');

function renderKnownUsers() {
    knownUsersDiv.innerHTML = '';
    getKnownUsers().forEach(name => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'known-user-chip';
        chip.textContent = name;
        chip.addEventListener('click', () => login(name));
        knownUsersDiv.appendChild(chip);
    });
}
function login(name) {
    name = name.trim();
    if (!name) return;
    setCurrentUser(name);
    navbar.classList.remove('hidden');
    navUser.textContent = name;
    navHistory = [];
    navIndex = -1;
    goToModePicker();
    showPage('game');
}
function logout() {
    if (currentSocket) { currentSocket.disconnect(); currentSocket = null; }
    clearCurrentUser();
    navbar.classList.add('hidden');
    navHistory = [];
    navIndex = -1;
    usernameInput.value = '';
    renderKnownUsers();
    showPage('login');
}
loginForm.addEventListener('submit', e => { e.preventDefault(); login(usernameInput.value); });
logoutBtn.addEventListener('click', logout);

/* =========================================================
   GAME PAGE — MODE SWITCHING
   ========================================================= */
const modePicker = document.getElementById('mode-picker');
const localSetup = document.getElementById('local-setup');
const onlineSetup = document.getElementById('online-setup');
const gameArea = document.getElementById('game-area');

function goToModePicker() {
    modePicker.classList.remove('hidden');
    localSetup.classList.add('hidden');
    onlineSetup.classList.add('hidden');
    gameArea.classList.add('hidden');
    document.getElementById('room-waiting').classList.add('hidden');
    document.getElementById('room-error').classList.add('hidden');
    if (currentSocket) { currentSocket.disconnect(); currentSocket = null; }
}
document.getElementById('pick-local').addEventListener('click', () => {
    modePicker.classList.add('hidden');
    localSetup.classList.remove('hidden');
    document.getElementById('local-player-o').value = getCurrentUser() || 'Player 1';
    document.getElementById('local-player-x').value = '';
});
document.getElementById('pick-online').addEventListener('click', () => {
    modePicker.classList.add('hidden');
    onlineSetup.classList.remove('hidden');
});
document.querySelectorAll('.back-to-picker').forEach(btn => btn.addEventListener('click', goToModePicker));

/* =========================================================
   SHARED BOARD UI
   ========================================================= */
const ticTacToes = document.querySelectorAll('#tic-tac-toe li');
const boardEl = document.getElementById('tic-tac-toe');
const alertDiv = document.getElementById('alert');
const alertMessage = alertDiv.querySelector('.message');
const alertSubMessage = alertDiv.querySelector('.sub-message');
const alertRestartBtn = document.getElementById('alert-restart');
const alertCloseBtn = document.getElementById('alert-close');
const restartBtn = document.getElementById('restart');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const currentPlayerEl = document.getElementById('current-player');
const timerEl = document.getElementById('timer');
const labelO = document.getElementById('label-o');
const labelX = document.getElementById('label-x');

const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

let mode = null; // 'local' | 'online'
let board = Array(9).fill('');
let player = 'O';
let gameOver = false;
let moveHistory = [];
let redoStack = [];
let timerInterval = null;
let startTime = null;
let elapsedMs = 0;
let namesByMode = { O: 'O', X: 'X' };

function renderBoard() {
    ticTacToes.forEach((li, i) => { li.dataset.value = board[i] || ''; });
    currentPlayerEl.textContent = player;
}
function startTimer() {
    if (timerInterval) return;
    startTime = Date.now() - elapsedMs;
    timerInterval = setInterval(() => {
        elapsedMs = Date.now() - startTime;
        timerEl.textContent = formatTime(elapsedMs);
    }, 250);
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

function showGameArea() {
    modePicker.classList.add('hidden');
    localSetup.classList.add('hidden');
    onlineSetup.classList.add('hidden');
    gameArea.classList.remove('hidden');
}

function closeAlert() { alertDiv.style.display = 'none'; }
alertCloseBtn.addEventListener('click', closeAlert);

function showResultAlert(result, elapsed) {
    const when = formatDateTime(new Date().toISOString());
    if (result === 'draw') {
        alertMessage.textContent = "It's a draw!";
        alertSubMessage.textContent = `${when} \u2022 Time: ${formatTime(elapsed)}`;
    } else {
        const winnerName = namesByMode[result] || result;
        alertMessage.textContent = `\uD83C\uDF89 Congratulations, ${winnerName}! \uD83C\uDF89`;
        alertSubMessage.textContent = `${result} wins \u2022 ${when} \u2022 Time: ${formatTime(elapsed)}`;
        celebrate();
    }
    alertDiv.style.display = 'flex';
}

/* ---------------------------------------------------------
   LOCAL (same device) MODE
   --------------------------------------------------------- */
document.getElementById('local-start-btn').addEventListener('click', () => {
    const oName = document.getElementById('local-player-o').value.trim() || 'Player O';
    const xName = document.getElementById('local-player-x').value.trim() || 'Player X';
    namesByMode = { O: oName, X: xName };
    labelO.textContent = `O: ${oName}`;
    labelX.textContent = `X: ${xName}`;
    startLocalGame();
});

function startLocalGame() {
    mode = 'local';
    board = Array(9).fill('');
    player = 'O';
    gameOver = false;
    moveHistory = [];
    redoStack = [];
    elapsedMs = 0;
    stopTimer();
    timerEl.textContent = '00:00';
    boardEl.classList.remove('disabled');
    undoBtn.classList.remove('hidden');
    redoBtn.classList.remove('hidden');
    renderBoard();
    updateUndoRedoButtons();
    showGameArea();
}

function updateUndoRedoButtons() {
    undoBtn.disabled = moveHistory.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

function handleLocalMove(key) {
    if (gameOver || board[key]) return;
    startTimer();
    moveHistory.push({ board: [...board], player });
    redoStack = [];
    board[key] = player;
    player = player === 'O' ? 'X' : 'O';
    renderBoard();
    updateUndoRedoButtons();
    checkLocalGameEnd();
}
function checkLocalGameEnd() {
    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            finishLocalGame(board[a]);
            return;
        }
    }
    if (board.every(cell => cell)) finishLocalGame('draw');
}
function finishLocalGame(result) {
    gameOver = true;
    stopTimer();
    boardEl.classList.add('disabled');
    fetch('/api/record-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            playerX: namesByMode.X,
            playerO: namesByMode.O,
            result,
            elapsedMs
        })
    }).catch(() => {});
    showResultAlert(result, elapsedMs);
}
function undo() {
    if (mode !== 'local' || moveHistory.length === 0 || gameOver) return;
    const last = moveHistory.pop();
    redoStack.push({ board: [...board], player });
    board = last.board;
    player = last.player;
    renderBoard();
    updateUndoRedoButtons();
}
function redo() {
    if (mode !== 'local' || redoStack.length === 0 || gameOver) return;
    const next = redoStack.pop();
    moveHistory.push({ board: [...board], player });
    board = next.board;
    player = next.player;
    renderBoard();
    updateUndoRedoButtons();
}
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

/* ---------------------------------------------------------
   ONLINE (two devices) MODE
   --------------------------------------------------------- */
let currentSocket = null;
let mySymbol = null;
let currentRoomCode = null;

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinCodeInput = document.getElementById('join-code-input');
const roomWaiting = document.getElementById('room-waiting');
const roomCodeDisplay = document.getElementById('room-code-display');
const roomError = document.getElementById('room-error');

function getSocket() {
    if (!currentSocket) currentSocket = io();
    return currentSocket;
}

createRoomBtn.addEventListener('click', () => {
    const name = getCurrentUser() || 'Player';
    const socket = getSocket();
    roomError.classList.add('hidden');
    socket.emit('create-room', { name });
    bindOnlineSocketEvents(socket);
});
joinRoomBtn.addEventListener('click', () => {
    const name = getCurrentUser() || 'Player';
    const code = joinCodeInput.value.trim();
    if (!code) return;
    const socket = getSocket();
    roomError.classList.add('hidden');
    socket.emit('join-room', { name, code });
    bindOnlineSocketEvents(socket);
});

function bindOnlineSocketEvents(socket) {
    if (socket._bound) return;
    socket._bound = true;

    socket.on('room-created', ({ code, symbol }) => {
        currentRoomCode = code;
        mySymbol = symbol;
        roomCodeDisplay.textContent = code;
        roomWaiting.classList.remove('hidden');
    });

    socket.on('join-error', ({ message }) => {
        roomError.textContent = message;
        roomError.classList.remove('hidden');
    });

    socket.on('game-start', ({ board: b, turn, names, startTime: st }) => {
        mode = 'online';
        board = b;
        player = turn;
        gameOver = false;
        elapsedMs = Date.now() - st;
        namesByMode = names;
        labelO.textContent = `O: ${names.O}`;
        labelX.textContent = `X: ${names.X}`;
        undoBtn.classList.add('hidden');
        redoBtn.classList.add('hidden');
        boardEl.classList.remove('disabled');
        renderBoard();
        stopTimer();
        startTime = st;
        timerInterval = setInterval(() => {
            elapsedMs = Date.now() - startTime;
            timerEl.textContent = formatTime(elapsedMs);
        }, 250);
        closeAlert();
        showGameArea();
    });

    socket.on('board-update', ({ board: b, turn }) => {
        board = b;
        player = turn;
        renderBoard();
    });

    socket.on('game-over', ({ result, elapsedMs: ems }) => {
        gameOver = true;
        stopTimer();
        boardEl.classList.add('disabled');
        showResultAlert(result, ems);
    });

    socket.on('opponent-left', () => {
        stopTimer();
        alertMessage.textContent = 'Opponent disconnected';
        alertSubMessage.textContent = 'Start a new room to keep playing.';
        alertDiv.style.display = 'flex';
        gameOver = true;
    });
}

document.getElementById('leave-game').addEventListener('click', () => {
    goToModePicker();
});

/* ---------------------------------------------------------
   BOARD CLICK — routes to local or online handler
   --------------------------------------------------------- */
ticTacToes.forEach((li, key) => {
    li.addEventListener('click', () => {
        if (mode === 'local') {
            handleLocalMove(key);
        } else if (mode === 'online') {
            if (gameOver || board[key] || player !== mySymbol) return;
            currentSocket.emit('move', { index: key });
        }
    });
});

restartBtn.addEventListener('click', () => {
    if (mode === 'local') {
        startLocalGame();
    } else if (mode === 'online' && currentSocket) {
        currentSocket.emit('restart-room');
    }
});
alertRestartBtn.addEventListener('click', () => {
    closeAlert();
    if (mode === 'local') startLocalGame();
    else if (mode === 'online' && currentSocket) currentSocket.emit('restart-room');
});

/* =========================================================
   LEADERBOARD
   ========================================================= */
const leaderboardBody = document.getElementById('leaderboard-body');
const leaderboardEmpty = document.getElementById('leaderboard-empty');

function renderLeaderboard() {
    fetch('/api/leaderboard').then(r => r.json()).then(data => {
        const currentUser = getCurrentUser();
        const rows = Object.entries(data)
            .map(([name, u]) => ({ name, ...u }))
            .filter(r => r.gamesPlayed > 0);
        rows.sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);

        leaderboardBody.innerHTML = '';
        leaderboardEmpty.classList.toggle('hidden', rows.length > 0);
        rows.forEach((r, i) => {
            const tr = document.createElement('tr');
            tr.className = `rank-${i + 1}${r.name === currentUser ? ' me' : ''}`;
            tr.innerHTML = `
                <td>#${i + 1}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${r.wins}</td>
                <td>${r.draws}</td>
                <td>${r.losses}</td>
                <td>${r.gamesPlayed}</td>
                <td>${r.bestTimeMs !== null ? formatTime(r.bestTimeMs) : '\u2014'}</td>
            `;
            leaderboardBody.appendChild(tr);
        });
    }).catch(() => {
        leaderboardBody.innerHTML = '';
        leaderboardEmpty.classList.remove('hidden');
        leaderboardEmpty.textContent = 'Could not load leaderboard. Is the server running?';
    });
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* =========================================================
   CALENDAR + HISTORY
   ========================================================= */
let calViewDate = new Date();
let calSelectedKey = null;
let historyCache = [];

const calGrid = document.getElementById('calendar-grid');
const calMonthLabel = document.getElementById('cal-month-label');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const historyTitle = document.getElementById('history-title');

document.getElementById('cal-prev').addEventListener('click', () => {
    calViewDate.setMonth(calViewDate.getMonth() - 1);
    calSelectedKey = null;
    drawCalendarGrid();
});
document.getElementById('cal-next').addEventListener('click', () => {
    calViewDate.setMonth(calViewDate.getMonth() + 1);
    calSelectedKey = null;
    drawCalendarGrid();
});

function renderCalendarPage() {
    fetch('/api/history').then(r => r.json()).then(data => {
        historyCache = data;
        calSelectedKey = null;
        drawCalendarGrid();
        drawHistoryList(historyCache.slice(0, 25));
        historyTitle.textContent = 'Recent Games';
    }).catch(() => {
        historyCache = [];
        drawCalendarGrid();
        historyList.innerHTML = '';
        historyEmpty.classList.remove('hidden');
        historyEmpty.textContent = 'Could not load history. Is the server running?';
    });
}

function drawCalendarGrid() {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    calMonthLabel.textContent = calViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const gamesByDay = {};
    historyCache.forEach(entry => {
        const k = dateKey(entry.timestamp);
        gamesByDay[k] = (gamesByDay[k] || 0) + 1;
    });

    calGrid.innerHTML = '';
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
        const el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = d;
        calGrid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startOffset; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day empty';
        calGrid.appendChild(el);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${year}-${month}-${day}`;
        const count = gamesByDay[key] || 0;
        const el = document.createElement('div');
        el.className = 'cal-day' + (count > 0 ? ' has-games' : '') + (key === calSelectedKey ? ' selected' : '');
        el.innerHTML = `${day}` + (count > 0 ? `<div class="cal-dot"></div>` : '');
        if (count > 0) {
            el.title = `${count} game${count > 1 ? 's' : ''}`;
            el.addEventListener('click', () => {
                calSelectedKey = (calSelectedKey === key) ? null : key;
                drawCalendarGrid();
                if (calSelectedKey) {
                    const filtered = historyCache.filter(e => dateKey(e.timestamp) === key);
                    drawHistoryList(filtered);
                    historyTitle.textContent = `Games on ${new Date(year, month, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                } else {
                    drawHistoryList(historyCache.slice(0, 25));
                    historyTitle.textContent = 'Recent Games';
                }
            });
        }
        calGrid.appendChild(el);
    }
}

function drawHistoryList(entries) {
    historyList.innerHTML = '';
    historyEmpty.classList.toggle('hidden', entries.length > 0);
    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const resultText = entry.result === 'draw' ? 'Draw' : `\uD83C\uDFC6 ${escapeHtml(entry.winnerName)}`;
        div.innerHTML = `
            <div>
                <div class="hi-players">${escapeHtml(entry.playerO)} (O) vs ${escapeHtml(entry.playerX)} (X)</div>
                <div class="hi-meta">${formatDateTime(entry.timestamp)} \u2022 ${entry.mode} \u2022 ${formatTime(entry.elapsedMs)}</div>
            </div>
            <div class="hi-result">${resultText}</div>
        `;
        historyList.appendChild(div);
    });
}

/* =========================================================
   INIT
   ========================================================= */
(function init() {
    const user = getCurrentUser();
    if (user) {
        navbar.classList.remove('hidden');
        navUser.textContent = user;
        goToModePicker();
        showPage('game');
    } else {
        renderKnownUsers();
        showPage('login');
    }
})();
