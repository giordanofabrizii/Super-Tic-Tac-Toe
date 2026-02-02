let GIOCATORE = "O";
let MATRICE = [];
const board = document.getElementById("game-container");
const displayGiocatoreEl = document.getElementById("giocatore_attuale");
const combinazioniVincenti = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function chiudiSpiegazioni() {
  document.getElementById("spiegazioni").classList.add("hidden");
}

function chiudiVittoria() {
  document.getElementById("vittoria").classList.add("hidden");
}

function mostraVittoria(vincitore) {
  const modal = document.getElementById("vittoria");
  const simbolo = document.getElementById("winner-symbol");
  const nome = document.getElementById("winner-name");

  simbolo.textContent = vincitore;
  simbolo.className = `winner-symbol ${vincitore.toLowerCase()}`;
  nome.textContent = vincitore;

  modal.classList.remove("hidden");
}

function nuovaPartita() {
  chiudiVittoria();
  
  // In modalità online, esci e torna alla selezione
  if (typeof isOnlineMode !== 'undefined' && isOnlineMode) {
    exitGame();
  } else {
    generateTable();
  }
}

function mostraRegole() {
  chiudiVittoria();
  document.getElementById("spiegazioni").classList.remove("hidden");
}

function checkWin(tris) {
  for (let combo of combinazioniVincenti) {
    let [a, b, c] = combo;
    if (tris[a] !== "" && tris[a] === tris[b] && tris[a] === tris[c]) {
      return tris[a]; // "O" oppure "X"
    }
  }
  return null; // nessun vincitore
}

function isTrisComplete(tris) {
  // Controlla se tutte le celle sono occupate
  return Array.isArray(tris) && tris.every((cell) => cell !== "");
}

function returnTris(numero) {
  // trovare il modo di ritornare [numero tris grande, numero tris piccolo]
  let big = Math.floor(numero / 10);
  let small = numero - big * 10;
  return [big, small];
}

function handleClick(cella, isRemote = false) {
  let [big, small] = returnTris(cella.id);
  let matriceEl = document.querySelectorAll("bigTris");

  // In modalità online e NON è una mossa remota, verifica che sia il turno del giocatore
  if (typeof isOnlineMode !== 'undefined' && isOnlineMode && !isRemote) {
    if (typeof myPlayer !== 'undefined' && GIOCATORE !== myPlayer) {
      console.log('Non è il tuo turno! GIOCATORE:', GIOCATORE, 'myPlayer:', myPlayer);
      return; // Non è il tuo turno
    }
  }

  // controlla se cliccato, se ha la classe toPlay o se è già completato
  if (
    MATRICE[big][small] !== "" ||
    !matriceEl[big].classList.contains("toPlay") ||
    !Array.isArray(MATRICE[big])
  ) {
    return;
  }

  // rimuovi classe toPlay da tutte le celle
  matriceEl.forEach((el) => {
    el.classList.remove("toPlay");
  });

  // aggiungi forma
  let segno = document.createElement("segno");
  segno.textContent = GIOCATORE;
  segno.classList.add(GIOCATORE.toLowerCase());
  cella.appendChild(segno);
  MATRICE[big][small] = GIOCATORE;

  // Se modalità online e NON è una mossa remota, invia la mossa
  if (typeof isOnlineMode !== 'undefined' && isOnlineMode && !isRemote) {
    if (typeof sendRemoteMove === 'function') {
      sendRemoteMove(big, small);
    }
  }

  let trisGrande = matriceEl[big];
  let vincitore = checkWin(MATRICE[big]);

  if (vincitore) {
    // cambio tris con segno del vincitore
    MATRICE[big] = vincitore;
    // aggiungo segno big tris
    let bigSegno = document.createElement("bigsegno");
    bigSegno.textContent = vincitore;
    bigSegno.classList.add(vincitore.toLowerCase());
    trisGrande.appendChild(bigSegno);

    // controllo vittoria della matrice
    let vincitoreFinale = checkWin(MATRICE);
    if (vincitoreFinale) {
      setTimeout(() => {
        mostraVittoria(vincitoreFinale);
      }, 500);
      return;
    }
  } else if (isTrisComplete(MATRICE[big])) {
    // Il tris è pieno ma nessuno ha vinto - segna come "DRAW"
    MATRICE[big] = "DRAW";
    // aggiungo overlay per indicare pareggio
    let drawOverlay = document.createElement("bigsegno");
    drawOverlay.textContent = "=";
    drawOverlay.style.color = "#888888";
    drawOverlay.style.fontSize = "60px";
    trisGrande.appendChild(drawOverlay);
  }

  // forza il prossimo giocatore a giocare sul giusto tris
  let nextTris = MATRICE[small];
  if (!Array.isArray(nextTris)) {
    // Il tris di destinazione è già vinto o in pareggio - metti toPlay a tutti i tris giocabili
    MATRICE.forEach((tris, index) => {
      if (Array.isArray(tris) && !isTrisComplete(tris)) {
        matriceEl[index].classList.add("toPlay");
      }
    });
  } else if (isTrisComplete(nextTris)) {
    // Il tris di destinazione è pieno - metti toPlay a tutti i tris giocabili
    MATRICE.forEach((tris, index) => {
      if (Array.isArray(tris) && !isTrisComplete(tris)) {
        matriceEl[index].classList.add("toPlay");
      }
    });
  } else {
    matriceEl[small].classList.add("toPlay");
  }

  // switch player
  GIOCATORE = GIOCATORE == "O" ? "X" : "O";
  displayGiocatoreEl.textContent = GIOCATORE;
}

function reset() {
  board.innerHTML = "";
  MATRICE = [];
  GIOCATORE = "O";
  displayGiocatoreEl.textContent = GIOCATORE;
}

function generateTable() {
  reset();
  
  // In modalità online, mostra l'UI online
  if (typeof isOnlineMode !== 'undefined' && isOnlineMode) {
    document.getElementById('online-ui').classList.remove('hidden');
    if (typeof currentGameId !== 'undefined' && currentGameId) {
      document.getElementById('current-game-code').textContent = currentGameId;
    }
  }
  
  for (let i = 0; i < 9; i++) {
    // Big tris
    const tris = document.createElement("bigTris");
    tris.classList.add("big-tris", "toPlay");
    MATRICE.push([]);

    for (let j = 0; j < 9; j++) {
      // Small tris
      const cella = document.createElement("smallTris");
      cella.classList.add("small-tris");
      cella.addEventListener("click", (e) => handleClick(cella));

      // id
      let id = i * 10 + j;
      cella.id = id;
      MATRICE[i].push("");
      tris.appendChild(cella);
    }
    board.appendChild(tris);
  }
}

// NON inizializza più automaticamente - ora gestito da multiplayer.js
// generateTable();