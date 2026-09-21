// L'host conserva la cronologia autorevole. L'ospite invia richieste di mossa
// e ricostruisce il tabellone dagli snapshot ricevuti, anche dopo una riconnessione.
let peer = null;
let conn = null;
let currentGameId = null;
let myPlayer = null;
let isHost = false;
let isOnlineMode = false;
let guestToken = null;
let acceptedGuestToken = null;
let moves = [];
let reconnectTimer = null;
let connectionTimer = null;
let pendingMove = false;
let generation = 0;

const STORAGE_KEY = 'super-tris-session-v2';
const PEER_OPTIONS = {
  host: '0.peerjs.com',
  secure: true,
  port: 443,
  path: '/',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};

function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value, index) =>
    (index === 4 ? '-' : '') + chars[value % chars.length]
  ).join('');
}

function makeToken() {
  return crypto.randomUUID ? crypto.randomUUID() :
    [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
}

function validGameId(value) {
  return /^[A-NP-Z2-9]{4}-[A-NP-Z2-9]{4}$/.test(value);
}

function saveSession() {
  if (!isOnlineMode) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      gameId: currentGameId,
      isHost,
      guestToken,
      acceptedGuestToken,
      moves
    }));
  } catch (error) {
    console.warn('Impossibile salvare la partita nel browser', error);
  }
}

function readSession() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || !validGameId(data.gameId) || typeof data.isHost !== 'boolean' ||
        !Array.isArray(data.moves)) return null;
    return data;
  } catch {
    return null;
  }
}

function updateConnectionStatus(status, message) {
  document.getElementById('connection-status').textContent = message;
  document.getElementById('status-dot').className = 'status-dot ' + status;
  document.getElementById('waiting-message').textContent = message;
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function showModeSelection() {
  showModal('mode-selection-modal');
  const session = readSession();
  const resume = document.getElementById('resume-game-btn');
  resume.classList.toggle('hidden', !session);
  if (session) document.getElementById('resume-code').textContent = session.gameId;
}

function showError(message) {
  alert(message);
}

function updateRoomUI() {
  document.getElementById('online-ui').classList.remove('hidden');
  document.getElementById('current-game-code').textContent = currentGameId;
  document.getElementById('game-code-display').textContent = currentGameId;
  const url = new URL(window.location.href);
  url.searchParams.set('game', currentGameId);
  const link = document.getElementById('share-link');
  link.href = url.href;
  link.textContent = url.href;
  document.getElementById('waiting-info').classList.toggle('hidden', !isHost);
  document.getElementById('copy-code-btn').classList.toggle('hidden', !isHost);
  history.replaceState(null, '', url.href);
}

function clearTimers() {
  clearTimeout(reconnectTimer);
  clearTimeout(connectionTimer);
}

function disposeConnection() {
  clearTimers();
  if (conn) {
    const old = conn;
    conn = null;
    old.close();
  }
  if (peer) {
    const old = peer;
    peer = null;
    old.destroy();
  }
}

function startSession(gameId, host, session = null) {
  generation++;
  disposeConnection();
  isOnlineMode = true;
  isHost = host;
  myPlayer = host ? 'O' : 'X';
  currentGameId = gameId;
  guestToken = host ? null : (session?.guestToken || makeToken());
  acceptedGuestToken = host ? (session?.acceptedGuestToken || null) : null;
  moves = host && Array.isArray(session?.moves) ? session.moves : [];
  pendingMove = false;
  hideModal('mode-selection-modal');
  hideModal('join-modal');
  updateRoomUI();
  saveSession();
  if (!renderMoves(moves)) {
    moves = [];
    renderMoves(moves);
    saveSession();
  }
  updateConnectionStatus('waiting', host ? 'In attesa dell’avversario…' : 'Connessione in corso…');
  showModal('waiting-modal');
  createPeer(generation);
}

function createPeer(run) {
  if (run !== generation || !isOnlineMode) return;
  if (peer && !peer.destroyed) {
    if (peer.disconnected) {
      try { peer.reconnect(); } catch (error) { console.warn(error); }
    } else if (!isHost && peer.open && (!conn || !conn.open)) {
      connectToHost(run);
    }
    return;
  }

  const id = isHost ? currentGameId : 'super-tris-' + makeToken();
  const instance = new Peer(id, PEER_OPTIONS);
  peer = instance;

  instance.on('open', () => {
    if (run !== generation || peer !== instance) return;
    if (!isHost && (!conn || !conn.open)) connectToHost(run);
    if (isHost && (!conn || !conn.open)) {
      updateConnectionStatus('waiting', 'In attesa dell’avversario…');
    }
  });
  instance.on('connection', incoming => {
    if (run !== generation || !isHost) {
      incoming.close();
      return;
    }
    setupConnection(incoming, run);
  });
  instance.on('disconnected', () => {
    if (run !== generation) return;
    if (!conn || !conn.open) updateConnectionStatus('waiting', 'Riconnessione al server…');
    scheduleReconnect(run);
  });
  instance.on('error', error => {
    if (run !== generation) return;
    console.warn('PeerJS:', error);
    if (error.type === 'unavailable-id') {
      updateConnectionStatus('waiting', 'Codice ancora occupato. Nuovo tentativo tra poco…');
      instance.destroy();
      peer = null;
      scheduleReconnect(run);
      return;
    }
    scheduleReconnect(run);
  });
  instance.on('close', () => {
    if (run !== generation || peer !== instance) return;
    peer = null;
    scheduleReconnect(run);
  });
}

function scheduleReconnect(run) {
  if (run !== generation || !isOnlineMode) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (run !== generation) return;
    if (peer && !peer.destroyed && peer.disconnected) {
      try { peer.reconnect(); } catch { peer.destroy(); peer = null; }
    }
    if (!peer || peer.destroyed) createPeer(run);
    if (!isHost && peer?.open && (!conn || !conn.open)) connectToHost(run);
    if (!conn?.open && (!isHost || !peer?.open)) scheduleReconnect(run);
  }, 3000);
}

function connectToHost(run) {
  if (run !== generation || isHost || !peer?.open || conn?.open) return;
  if (conn) conn.close();
  const outgoing = peer.connect(currentGameId, { reliable: true });
  setupConnection(outgoing, run);
  clearTimeout(connectionTimer);
  connectionTimer = setTimeout(() => {
    if (run === generation && conn === outgoing && !outgoing.open) {
      outgoing.close();
      scheduleReconnect(run);
    }
  }, 10000);
}

function setupConnection(connection, run) {
  if (run !== generation) return;
  if (conn && conn.open && conn !== connection) {
    // La stessa stanza ammette un solo avversario alla volta.
    connection.close();
    return;
  }
  if (conn && conn !== connection) conn.close();
  conn = connection;
  connection.on('open', () => {
    if (run !== generation || conn !== connection) return;
    clearTimeout(connectionTimer);
    if (isHost) {
      updateConnectionStatus('waiting', 'Avversario collegato, sincronizzazione…');
    } else {
      connection.send({ type: 'hello', token: guestToken });
      updateConnectionStatus('waiting', 'Sincronizzazione partita…');
    }
  });
  connection.on('data', message => {
    if (run === generation && conn === connection) handleRemoteMessage(message);
  });
  connection.on('close', () => {
    if (run !== generation || conn !== connection) return;
    conn = null;
    pendingMove = false;
    updateConnectionStatus('waiting', 'Connessione persa. Riconnessione automatica…');
    showModal('waiting-modal');
    scheduleReconnect(run);
  });
  connection.on('error', error => {
    if (run !== generation || conn !== connection) return;
    console.warn('Connessione:', error);
    connection.close();
  });
}

function sendSnapshot() {
  if (conn?.open) conn.send({ type: 'state', moves });
}

function handleRemoteMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (isHost) {
    if (message.type === 'hello') {
      if (typeof message.token !== 'string' || !message.token) return;
      acceptedGuestToken = message.token;
      saveSession();
      sendSnapshot();
      updateConnectionStatus('connected', 'Connesso');
      hideModal('waiting-modal');
    } else if (message.type === 'leave' && message.token === acceptedGuestToken) {
      acceptedGuestToken = null;
      saveSession();
      conn.close();
    } else if (message.type === 'move' && acceptedGuestToken &&
               message.token === acceptedGuestToken) {
      const { big, small, revision } = message;
      if (revision === moves.length && GIOCATORE === 'X' &&
          Number.isInteger(big) && Number.isInteger(small)) {
        const cell = document.getElementById(String(big * 10 + small));
        if (cell && handleClick(cell, true)) {
          moves.push({ big, small, player: 'X' });
          saveSession();
        }
      }
      sendSnapshot();
    }
  } else if (message.type === 'state' && Array.isArray(message.moves)) {
    if (renderMoves(message.moves)) {
      moves = message.moves;
      pendingMove = false;
      saveSession();
      updateConnectionStatus('connected', 'Connesso');
      hideModal('waiting-modal');
    } else {
      renderMoves(moves);
    }
  }
}

function renderMoves(history) {
  if (!Array.isArray(history) || history.length > 81) return false;
  generateTable();
  for (const move of history) {
    if (!move || !Number.isInteger(move.big) || !Number.isInteger(move.small) ||
        (move.player !== 'O' && move.player !== 'X') || move.player !== GIOCATORE) {
      return false;
    }
    const cell = document.getElementById(String(move.big * 10 + move.small));
    if (!cell || !handleClick(cell, true)) return false;
  }
  return true;
}

function onHostMoveApplied(big, small, player) {
  moves.push({ big, small, player });
  saveSession();
  sendSnapshot();
}

function requestOnlineMove(big, small) {
  if (pendingMove || !conn?.open) return false;
  pendingMove = true;
  const run = generation;
  conn.send({ type: 'move', big, small, revision: moves.length, token: guestToken });
  // Se la risposta si perde, richiedi nuovamente lo stato con una riconnessione.
  setTimeout(() => {
    if (run === generation && pendingMove && isOnlineMode && !isHost) {
      pendingMove = false;
      if (conn?.open) conn.send({ type: 'hello', token: guestToken });
    }
  }, 5000);
  return true;
}

function createOnlineGame() {
  startSession(generateGameId(), true);
}

function joinOnlineGame(gameId) {
  const normalized = gameId.trim().toUpperCase();
  if (!validGameId(normalized)) {
    showError('Inserisci un codice nel formato ABCD-2345.');
    return;
  }
  const saved = readSession();
  startSession(normalized, false, saved?.gameId === normalized && !saved.isHost ? saved : null);
}

function resumeGame() {
  const session = readSession();
  if (session) startSession(session.gameId, session.isHost, session);
}

function playLocal() {
  generation++;
  disposeConnection();
  isOnlineMode = false;
  hideModal('mode-selection-modal');
  hideModal('waiting-modal');
  document.getElementById('online-ui').classList.add('hidden');
  generateTable();
}

function showCreateGame() {
  createOnlineGame();
}

function showJoinGame() {
  hideModal('mode-selection-modal');
  showModal('join-modal');
  document.getElementById('join-code-input').focus();
}

function submitJoinGame() {
  joinOnlineGame(document.getElementById('join-code-input').value);
}

async function copyGameCode() {
  try {
    await navigator.clipboard.writeText(currentGameId);
    const button = document.getElementById('copy-code-btn');
    button.textContent = '✓ Copiato';
    setTimeout(() => { button.textContent = 'Copia codice'; }, 2000);
  } catch {
    showError('Copia il codice mostrato sopra.');
  }
}

function exitGame(skipConfirm = false) {
  if (!skipConfirm && !confirm('Vuoi uscire dalla partita?')) return;
  if (!isHost && conn?.open) conn.send({ type: 'leave', token: guestToken });
  generation++;
  disposeConnection();
  isOnlineMode = false;
  currentGameId = null;
  myPlayer = null;
  isHost = false;
  moves = [];
  localStorage.removeItem(STORAGE_KEY);
  hideModal('waiting-modal');
  hideModal('vittoria');
  document.getElementById('online-ui').classList.add('hidden');
  document.getElementById('game-container').innerHTML = '';
  const url = new URL(window.location.href);
  url.searchParams.delete('game');
  history.replaceState(null, '', url.href);
  showModeSelection();
}

window.addEventListener('DOMContentLoaded', () => {
  const fromLink = new URLSearchParams(location.search).get('game')?.toUpperCase();
  const saved = readSession();
  if (fromLink && validGameId(fromLink)) {
    if (saved?.gameId === fromLink) {
      resumeGame();
    } else {
      document.getElementById('join-code-input').value = fromLink;
      showJoinGame();
    }
  } else if (saved) {
    resumeGame();
  } else {
    showModeSelection();
  }
});
