let casellePiccole = Array.from(document.getElementsByClassName('casellaPiccola'));
// chiamo le caselle per poi inserire il testo all'interno

let caselleGrandi = Array.from(document.getElementsByClassName('casellaGrande'));
const O_GIOCATORE = "O";
const X_GIOCATORE = "X";
let giocatore = X_GIOCATORE 
let daCompletare = Array(81).fill(null); 
// questo array si aggiorna ogni volta che si clicca una casella, si verificano poi le condizioni

let vittoria = Array(9).fill(null);
// da questo array si controllano le condizioni di vittoria del super tris

const iniziaGioco = () => {
    casellePiccole.forEach(casellaPiccola => casellaPiccola.addEventListener('click', casellaCliccata))
    // all'inizio tutte le caselle possono essere cliccate
}

function casellaCliccata(e) {
    const id = e.target.id;
    casellePiccole.forEach(casellaPiccola => casellaPiccola.removeEventListener('click', casellaCliccata))
    // ora togliamo il click da tutte le caselle per aggiungerlo solo a quelle dove si puo effettivamente cliccare

    let inizioRiga = Math.floor(id/9); // prende la casella numero 0 del tris grande cliccato
    for (let i = 0; i < 9; i++) {
        let casellaDaResettare = document.getElementById(((inizioRiga * 9) + i).toString());
        casellaDaResettare.style.background='rgb(84, 82, 187)'; // rimettiamo il background originale
    }
    if(!daCompletare[id]){ //se la casella non e' completata
        daCompletare[id] = giocatore;
        e.target.innerText = giocatore;

        //controlla se hai vinto
        if(vincita(id) !== false){ //se ha vinto
            let blocchiVincenti = vincita(id);

            blocchiVincenti.map(casellaPiccola => casellePiccole[casellaPiccola].style.background='rgba(0, 0, 0, 0.5)');
            vittoria[Math.floor(blocchiVincenti[0] / 9)] = giocatore; // inserisce il segno del giocatore
 
            for (let i = 0; i < 9; i++) { // rimuove l'event listener dai tris gia completati
                let casellaDaRimuovere = document.getElementById(i.toString());
                casellaDaRimuovere.removeEventListener('click', casellaCliccata);
            }
        
            if (superTris() !== false){
                let blocchiVincenti = superTris();
                console.log('a')
                blocchiVincenti.map(casellaGrande => caselleGrandi[casellaGrande].style.background='green');
                return
            }

        }

        if (patta(id) !== false){
            let blocchiVincenti = patta(id);
            vittoria[Math.floor(blocchiVincenti[0] / 9)] = 'A'; // inserisce il segno del giocatore

            blocchiVincenti.map(casellaPiccola => casellePiccole[casellaPiccola].style.background='#b10000');
        }
        
        // se non hai vinto il tris, e nemmeno e' patto, aggiugiamo il listener
        let inizioRiga = Math.floor(id/9); // prende l'indice del tris grande a cui deve andare
        let trisScelto = (id - (inizioRiga * 9)); // prende l'indice del tris piccolo a cui deve andare
        if (vittoria[trisScelto] == null){ // se il tris grande scelto e' libero
            for (let i = 0; i < 9; i++) { // aggiungiamo un event listener alle caselle del tris grande
                let casellaDaAggiungere = document.getElementById(((trisScelto * 9)+i).toString());
                casellaDaAggiungere.addEventListener('click', casellaCliccata);  
                casellaDaAggiungere.style.background='rgba(0, 0, 0, 0.2)' // aggiungiamo un background diverso 
            }
        } else {
            for (let i = 0; i < 9; i++) {
                if (vittoria[i] == null) {
                    for (let a = 0; a < 9; a++) {
                        let casellaDaAggiungere = document.getElementById(((i * 9)+a).toString());
                        casellaDaAggiungere.addEventListener('click', casellaCliccata); 
                    }
                }
            }
        }
        giocatore = giocatore == X_GIOCATORE ? O_GIOCATORE : X_GIOCATORE;
    } 
}

const combinazioniVincenti = [
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6]
]


function vincita(id) {
    for (const condizioni of combinazioniVincenti) {
        let [a, b, c] = condizioni;
        let inizioRiga = Math.floor(id/9); // serve solo la parte intera del numero
        let daControllare = daCompletare.slice(9 * inizioRiga, (9 * inizioRiga) + 9); // seleziona solo il tris del blocco cliccato
        
        if(daControllare[a] && (daControllare[a] == daControllare[b] && daControllare[a] == daControllare[c])) { // si controllano tutte le condizioni vincenti nel tris dato
            return [(9 * inizioRiga)+a,(9 * inizioRiga)+b,(9 * inizioRiga)+c]; // ritorna caselle da colorare
        }
    }
    return false;
}

function patta(id) {
    let inizioRiga = Math.floor(id/9);
    let daControllare = daCompletare.slice(9 * inizioRiga, (9 * inizioRiga) + 9);

    for (let i = 0; i < 9; i++) {
        if (daControllare[i] == null) {
            return false;
        }
    }
    return [(9 * inizioRiga)+0,(9 * inizioRiga)+1,(9 * inizioRiga)+2,(9 * inizioRiga)+3,(9 * inizioRiga)+4,(9 * inizioRiga)+5,(9 * inizioRiga)+6,(9 * inizioRiga)+7,(9 * inizioRiga)+8];
}

function superTris(){
    for (let condizioni of combinazioniVincenti) {
        let [a, b, c] = condizioni;
        if(vittoria[a] && (vittoria[a] == vittoria[b] && vittoria[a] == vittoria[c])){
            return [a, b, c];
        }
    }

    return false
}

function ricaricaPagina() {
    // Ricarica la pagina
    location.reload();
}

iniziaGioco()