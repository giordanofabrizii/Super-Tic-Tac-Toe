// ============================================
// MULTIPLAYER.JS - Gestione WebRTC con PeerJS
// ============================================

let peer = null;
let conn = null;
let currentGameId = null;
let myPlayer = null; // "O" o "X"
let isHost = false;
let isOnlineMode = false;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  id += '-';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function showError(message) {
  alert(message);
}

function updateConnectionStatus(status, message) {
  const statusEl = document.getElementById('connection-status');
  const statusDot = document.getElementById('status-dot');
  
  statusEl.textContent = message;
  
  if (status === 'connected') {
    statusDot.className = 'status-dot connected';
  } else if (status === 'waiting') {
    statusDot.className = 'status-dot waiting';
  } else {
    statusDot.className = 'status-dot disconnected';
  }
}

// ============================================
// PEERJS SETUP
// ============================================

function initializePeer(peerId) {
  return new Promise((resolve, reject) => {
    // Usa il server cloud ufficiale di PeerJS
    peer = new Peer(peerId, {
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
    });

    peer.on('open', (id) => {
      console.log('Peer connesso con ID:', id);
      resolve(id);
    });

    peer.on('error', (err) => {
      console.error('Errore peer:', err);
      
      // Se il server cloud fallisce, prova senza specificare host (usa default)
      if (err.type === 'network' || err.type === 'server-error') {
        console.log('Tentativo con configurazione di fallback...');
        peer = new Peer(peerId);
        
        peer.on('open', (id) => {
          console.log('Peer connesso (fallback) con ID:', id);
          resolve(id);
        });
        
        peer.on('error', (fallbackErr) => {
          reject(fallbackErr);
        });
      } else {
        reject(err);
      }
    });

    peer.on('connection', (connection) => {
      console.log('Ricevuta connessione in arrivo');
      conn = connection;
      setupConnection();
    });
  });
}

function setupConnection() {
  conn.on('open', () => {
    console.log('Connessione aperta');
    updateConnectionStatus('connected', '📡 Connesso');
    hideModal('waiting-modal');
    
    // Se sono l'host, inizializzo il gioco e notifico il joiner
    if (isHost) {
      generateTable();
      conn.send({ type: 'init' });
    }
  });

  conn.on('data', (data) => {
    handleRemoteMessage(data);
  });

  conn.on('close', () => {
    console.log('Connessione chiusa');
    updateConnectionStatus('disconnected', '⚠️ Disconnesso');
    showError('Connessione persa. La partita è terminata.');
  });

  conn.on('error', (err) => {
    console.error('Errore connessione:', err);
    showError('Errore di connessione: ' + err.message);
  });
}

// ============================================
// CREA PARTITA (HOST)
// ============================================

async function createOnlineGame() {
  try {
    isHost = true;
    isOnlineMode = true;
    myPlayer = 'O'; // L'host è sempre O
    currentGameId = generateGameId();
    
    showModal('waiting-modal');
    document.getElementById('game-code-display').textContent = currentGameId;
    
    // Imposta il link condivisibile
    const shareUrl = `${window.location.origin}${window.location.pathname}?game=${currentGameId}`;
    const shareLinkEl = document.getElementById('share-link');
    shareLinkEl.href = shareUrl;
    shareLinkEl.textContent = shareUrl;
    
    updateConnectionStatus('waiting', '⏳ In attesa avversario...');
    
    // Inizializza peer con il gameId come ID
    await initializePeer(currentGameId);
    
    console.log('In attesa di connessioni...');
    
  } catch (error) {
    console.error('Errore creazione partita:', error);
    showError('Errore durante la creazione della partita: ' + error.message);
    hideModal('waiting-modal');
  }
}

// ============================================
// UNISCITI A PARTITA (JOINER)
// ============================================

async function joinOnlineGame(gameId) {
  try {
    isHost = false;
    isOnlineMode = true;
    myPlayer = 'X'; // Il joiner è sempre X
    currentGameId = gameId;
    
    showModal('waiting-modal');
    document.getElementById('game-code-display').textContent = gameId;
    updateConnectionStatus('waiting', '⏳ Connessione in corso...');
    
    // Genera un ID casuale per il joiner
    const myPeerId = 'joiner-' + Math.random().toString(36).substr(2, 9);
    
    // Inizializza peer
    await initializePeer(myPeerId);
    
    // Connetti all'host usando il gameId
    conn = peer.connect(gameId, {
      reliable: true
    });
    
    setupConnection();
    
  } catch (error) {
    console.error('Errore unione partita:', error);
    showError('Errore durante l\'unione alla partita: ' + error.message);
    hideModal('waiting-modal');
  }
}

// ============================================
// INVIO E RICEZIONE MOSSE
// ============================================

function sendRemoteMove(big, small) {
  if (!isOnlineMode || !conn || !conn.open) {
    return;
  }
  
  const message = {
    type: 'move',
    payload: {
      big,
      small,
      player: myPlayer,
      timestamp: Date.now()
    }
  };
  
  conn.send(message);
}

function handleRemoteMessage(message) {
  if (message.type === 'move') {
    const { big, small, player } = message.payload;
    
    // Applica la mossa ricevuta
    applyRemoteMove(big, small, player);
  } else if (message.type === 'init') {
    // Il joiner riceve lo stato iniziale dall'host
    generateTable();
  }
}

function applyRemoteMove(big, small, player) {
  // Trova la cella corrispondente
  const cellId = big * 10 + small;
  const cella = document.getElementById(cellId);
  
  if (!cella) {
    console.error('Cella non trovata:', cellId);
    return;
  }
  
  console.log('Applico mossa remota:', { big, small, player, currentGIOCATORE: GIOCATORE });
  
  // Verifica che sia il turno corretto
  if (GIOCATORE !== player) {
    console.error('Turno non corretto! Atteso:', GIOCATORE, 'Ricevuto:', player);
    return;
  }
  
  // Simula il click - handleClick cambierà automaticamente GIOCATORE
  handleClick(cella, true);
}

// ============================================
// UI MODALS
// ============================================

function showModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function showModeSelection() {
  showModal('mode-selection-modal');
}

function playLocal() {
  isOnlineMode = false;
  hideModal('mode-selection-modal');
  document.getElementById('online-ui').classList.add('hidden');
  generateTable();
}

function showCreateGame() {
  hideModal('mode-selection-modal');
  createOnlineGame();
}

function showJoinGame() {
  hideModal('mode-selection-modal');
  showModal('join-modal');
}

function submitJoinGame() {
  const input = document.getElementById('join-code-input');
  const gameId = input.value.trim().toUpperCase();
  
  if (!gameId) {
    showError('Inserisci un codice partita');
    return;
  }
  
  hideModal('join-modal');
  joinOnlineGame(gameId);
}

function copyGameCode() {
  const code = document.getElementById('game-code-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-code-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Copiato!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  });
}

function exitGame() {
  if (confirm('Sei sicuro di voler uscire dalla partita?')) {
    if (conn) {
      conn.close();
    }
    if (peer) {
      peer.destroy();
    }
    
    isOnlineMode = false;
    currentGameId = null;
    myPlayer = null;
    isHost = false;
    
    document.getElementById('online-ui').classList.add('hidden');
    showModeSelection();
  }
}

// ============================================
// INIZIALIZZAZIONE
// ============================================

// Controlla se c'è un gameId nell'URL
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('game');
  
  if (gameId) {
    // Auto-join se c'è un codice nell'URL
    document.getElementById('join-code-input').value = gameId;
    showJoinGame();
  } else {
    // Mostra selezione modalità
    showModeSelection();
  }
  
  // Mostra UI online se necessario
  if (isOnlineMode) {
    document.getElementById('online-ui').classList.remove('hidden');
    if (currentGameId) {
      document.getElementById('current-game-code').textContent = currentGameId;
    }
  }
});