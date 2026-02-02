// ============================================
// MULTIPLAYER.JS - Gestione WebRTC e Online
// ============================================

let peerConnection = null;
let dataChannel = null;
let currentGameId = null;
let myPlayer = null; // "O" o "X"
let isHost = false;
let isOnlineMode = false;

// Configurazione STUN (server pubblico Google)
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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
// NETLIFY FUNCTIONS API
// ============================================

async function storeOffer(gameId, offer) {
  const response = await fetch('/.netlify/functions/store-offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, offer })
  });
  
  if (!response.ok) {
    throw new Error('Impossibile salvare l\'offerta');
  }
  
  return await response.json();
}

async function getOffer(gameId) {
  const response = await fetch(`/.netlify/functions/get-offer?gameId=${gameId}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Partita non trovata');
    }
    throw new Error('Impossibile recuperare l\'offerta');
  }
  
  return await response.json();
}

async function storeAnswer(gameId, answer) {
  const response = await fetch('/.netlify/functions/store-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, answer })
  });
  
  if (!response.ok) {
    throw new Error('Impossibile salvare la risposta');
  }
  
  return await response.json();
}

async function getAnswer(gameId) {
  const response = await fetch(`/.netlify/functions/get-answer?gameId=${gameId}`);
  
  if (!response.ok) {
    return null; // Answer non ancora disponibile
  }
  
  return await response.json();
}

// ============================================
// WEBRTC SETUP
// ============================================

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);
  
  peerConnection.onicecandidate = (event) => {
    // ICE candidates sono già inclusi nell'SDP
  };
  
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    
    if (peerConnection.connectionState === 'connected') {
      updateConnectionStatus('connected', '📡 Connesso');
      hideModal('waiting-modal');
      
      // Se sono l'host, inizializzo il gioco
      if (isHost) {
        generateTable();
      }
    } else if (peerConnection.connectionState === 'disconnected' || 
               peerConnection.connectionState === 'failed') {
      updateConnectionStatus('disconnected', '⚠️ Disconnesso');
      showError('Connessione persa. La partita è terminata.');
    }
  };
  
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log('Data channel aperto');
  };
  
  dataChannel.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleRemoteMessage(message);
  };
  
  dataChannel.onerror = (error) => {
    console.error('Data channel error:', error);
  };
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
    
    // Setup WebRTC
    setupPeerConnection();
    
    // Crea data channel (solo l'host lo crea)
    dataChannel = peerConnection.createDataChannel('game');
    setupDataChannel();
    
    // Crea offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Aspetta che ICE gathering sia completo
    await new Promise((resolve) => {
      if (peerConnection.iceGatheringState === 'complete') {
        resolve();
      } else {
        peerConnection.addEventListener('icegatheringstatechange', () => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve();
          }
        });
      }
    });
    
    // Salva offer su Netlify
    await storeOffer(currentGameId, peerConnection.localDescription);
    
    // Poll per l'answer
    pollForAnswer();
    
  } catch (error) {
    console.error('Errore creazione partita:', error);
    showError('Errore durante la creazione della partita: ' + error.message);
    hideModal('waiting-modal');
  }
}

async function pollForAnswer() {
  const maxAttempts = 60; // 60 secondi
  let attempts = 0;
  
  const interval = setInterval(async () => {
    attempts++;
    
    if (attempts > maxAttempts) {
      clearInterval(interval);
      showError('Timeout: nessun avversario si è unito.');
      hideModal('waiting-modal');
      return;
    }
    
    try {
      const result = await getAnswer(currentGameId);
      
      if (result && result.answer) {
        clearInterval(interval);
        await peerConnection.setRemoteDescription(result.answer);
      }
    } catch (error) {
      // Answer non ancora disponibile, continua polling
    }
  }, 1000);
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
    
    // Setup WebRTC
    setupPeerConnection();
    
    // Recupera offer
    const { offer } = await getOffer(gameId);
    await peerConnection.setRemoteDescription(offer);
    
    // Crea answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Aspetta ICE gathering
    await new Promise((resolve) => {
      if (peerConnection.iceGatheringState === 'complete') {
        resolve();
      } else {
        peerConnection.addEventListener('icegatheringstatechange', () => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve();
          }
        });
      }
    });
    
    // Salva answer
    await storeAnswer(gameId, peerConnection.localDescription);
    
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
  if (!isOnlineMode || !dataChannel || dataChannel.readyState !== 'open') {
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
  
  dataChannel.send(JSON.stringify(message));
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
  
  if (!cella) return;
  
  // Simula il click chiamando handleClick
  // Ma prima impostiamo temporaneamente GIOCATORE al player remoto
  const oldPlayer = GIOCATORE;
  GIOCATORE = player;
  handleClick(cella, true); // true = è una mossa remota
  GIOCATORE = oldPlayer; // Ripristina (anche se handleClick lo cambia già)
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
    if (peerConnection) {
      peerConnection.close();
    }
    if (dataChannel) {
      dataChannel.close();
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