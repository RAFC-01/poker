let lastPlayerID = sessionStorage.getItem("playerIDs");
const socket = io("http://localhost:3000", {
  auth: { playerID: lastPlayerID }
});
const G_canvas = document.querySelector('canvas');
const G_ctx = G_canvas.getContext('2d');

G_canvas.width = innerWidth;
G_canvas.height = innerHeight + 10;

const createdCards = {};
const loadedImages = {};

let scale = 3;

let testCard;
let dt;
let gameTime = 0;

const CARD_HEART = 0;
const CARD_DIAMOND = 1;
const CARD_SPADE = 2;
const CARD_CLUBS = 3;

const cardWidth = 38;
const cardHeight = 52;

let scaledCardWidth = cardWidth * scale;
let scaledCardHeight = cardHeight * scale;

let G_highestBet = 0;

const player = {
    hand: [],
    money: 5000,
    bet: 0,
    hasFolded: false
};

const chipPositions = {
    1000: {x: 48, y: 64},
    500: {x: 64, y: 64},
    250: {x: 80, y: 64},
    100: {x: 96, y: 64},
}

let cardsOnTable = [];
// let socket = {};

let players = [{
    id: 1,
    bet: 1000,
    timeJoined: 123,
    hasFolded: false,
}];

let currentTurnPlayerID;

function betMoney(amm){
    if ((currentTurnPlayerID !== player.id && player.firstBet) || player.money == 0) return;
    socket.emit("addBet", {money: amm}, (res) => {
        console.log(res.newMoney, res.bet);
        player.firstBet = true;
        player.bet = res.bet;
    })    
}

socket.on('connect', () => {
    console.log('connected!');
    player.id = lastPlayerID || socket.id;
    sessionStorage.setItem("playerIDs", player.id);
    socket.emit("getHand", {}, (res) => {
        player.hand = res.cards;
        player.bet = res.bet;
        player.hasFolded = res.folded;
        player.color = res.color;
        cardsOnTable = res.table;
        players = res.players;
        if (!player.bet) betMoney(1000);
    });
    socket.on("userJoin", (data) => {
        players = data;
        console.log('here');
        G_highestBet = getHighestBet();
    });
    socket.on("currentTurn", (data) => {
        currentTurnPlayerID = data;
        if (player.id == currentTurnPlayerID){
            yourTurn();
        }else{
            hideYourTurn();
        }
    });
    socket.on("tableCards", (res) => {
        cardsOnTable = res.cards;
    })
    socket.on("test", (res) => {
        console.log(res);
    })
});
function yourTurn(){
    document.getElementById("yourTurn").style.opacity = 1;
    setTimeout(()=> {
        document.getElementById("yourTurn").style.opacity = 0;
    }, 1000);
    document.getElementById("bet").style.display = 'block';
}
function hideYourTurn(){
    document.getElementById("bet").style.display = 'none';
}

function drawTableCards(){
    let gap = 20;
    let allCardsWidth = (scaledCardWidth + gap) * 5;
    let cardsStartPos = Math.floor(G_canvas.width / 2 - allCardsWidth / 2); 
    for (let i = 0; i < 5; i++){
        let points = cardsOnTable[i] ? cardsOnTable[i].points : 0;
        let type = cardsOnTable[i] ? cardsOnTable[i].type : 0;
        let card = getCard(points, type); 

        G_ctx.drawImage(card, cardsStartPos + i * (scaledCardWidth + gap), G_canvas.height / 2 - scaledCardHeight / 2, scaledCardWidth, scaledCardHeight);
    }
    G_ctx.beginPath();
    G_ctx.fillStyle = 'white';
    G_ctx.font = '20px Arial';
    G_ctx.fillText("Highest bet: "+G_highestBet, cardsStartPos, G_canvas.height / 2 - scaledCardHeight / 2 - 20);
    G_ctx.closePath();

}
function drawPlayerCards(){
    const atlas = loadedImages['poker.png'];

    let gap = 5;
    let allCardsWidth = (scaledCardWidth + gap) * player.hand.length;
    let cardsStartPos = Math.floor(G_canvas.width / 2 - allCardsWidth / 2); 

    // cards
    for (let i = 0; i < player.hand.length; i++){
        const cardInfo = player.hand[i];
        const card = getCard(cardInfo.points, cardInfo.type);
        G_ctx.drawImage(card, cardsStartPos + i * (scaledCardWidth + gap), G_canvas.height - scaledCardHeight, scaledCardWidth, scaledCardHeight);
    }
    // chips
    const chips = getChipsFromNumber(player.bet);
    const chipsArr = Object.keys(chips);
    const chipSize = 16 * scale;
    for (let j = 0; j < chipsArr.length; j++){
        const chip = chipsArr[j];
        for (let k = 0; k < chips[chip]; k++){
            G_ctx.drawImage(atlas, chipPositions[chip].x, chipPositions[chip].y, 16, 16, cardsStartPos + chipSize * j, G_canvas.height - (scaledCardHeight + chipSize) - 10 * k, chipSize, chipSize)
        }
    }
    // your turn indicator
    if (currentTurnPlayerID == player.id){
        let movedPos = Math.floor(Math.sin(gameTime) * 10);
        G_ctx.drawImage(atlas, 96, 48, 16, 16, Math.floor(cardsStartPos + allCardsWidth / 2 - chipSize / 2), (G_canvas.height - (scaledCardHeight + chipSize) - 15 * 5) + movedPos, chipSize, chipSize)
    }
    // player color
    G_ctx.beginPath();
    G_ctx.fillStyle = player.color;
    let size = 16 * scale;
    G_ctx.fillRect(cardsStartPos-size, G_canvas.height - size, size, size);
    G_ctx.closePath();

}
function drawOtherPlayers(){
    const sorted = players.sort((a, b) => {
        return a.timeJoined - b.timeJoined
    });
    const atlas = loadedImages['poker.png'];

    let gap = 5;
    let allCardsWidth = (scaledCardWidth + gap) * 2;
    let allCardsHeight = (scaledCardHeight + gap) * 2;

    let positions = [
        {x: Math.floor(G_canvas.width / 2 - allCardsWidth / 2), y: -10, angle: 180},
        {x: 10, y: Math.floor(G_canvas.height / 2 - allCardsHeight / 2), angle: 90},
        {x: G_canvas.width - scaledCardWidth - 10, y: Math.floor(G_canvas.height / 2 - allCardsHeight / 2), angle: -90},
    ];
    let actualIndex = 0;
    for (let i = 0; i < sorted.length; i++){
        if (sorted[i].id == player.id) continue;
        // draw cards
        if (!positions[actualIndex]) continue;
        for (let j = 0; j < 2; j++){
            let gapX = positions[actualIndex].angle == 0 || positions[actualIndex].angle == 180 ? j * (scaledCardWidth + gap) : 0;
            let gapY = positions[actualIndex].angle !== 0 && positions[actualIndex].angle !== 180 ? j * (scaledCardWidth + gap) : 0;
            G_ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transforms
            const x = positions[actualIndex].x + gapX;
            const y = positions[actualIndex].y + gapY;
            const card = getCard(0);
            let centerX = x + scaledCardWidth / 2;
            let centerY = y + scaledCardHeight / 2;
          
            G_ctx.save();
            G_ctx.translate(centerX, centerY);
            G_ctx.rotate(positions[actualIndex].angle * Math.PI / 180);
            G_ctx.drawImage(card, -scaledCardWidth / 2, -scaledCardHeight / 2, scaledCardWidth, scaledCardHeight);            
            G_ctx.restore();
        }
        

        // draw chips
        const chips = getChipsFromNumber(sorted[i].bet);
        const chipsArr = Object.keys(chips);
        const chipSize = 16 * scale;
        for (let j = 0; j < chipsArr.length; j++){
            const chip = chipsArr[j];
            for (let k = 0; k < chips[chip]; k++){
                let offsets = {
                    0: {
                        x: chipSize * j,
                        y: scaledCardHeight + 10 * k
                    },
                    1: {
                        x: (scaledCardWidth+20) + 10 * k,
                        y: 20 + chipSize * j
                    },
                    2: {
                        x: -(scaledCardWidth/2 + 10) - 10 * k,
                        y: 20 + chipSize * j
                    }
                }
                G_ctx.drawImage(atlas, chipPositions[chip].x, chipPositions[chip].y, 16, 16, positions[actualIndex].x + offsets[actualIndex].x, positions[actualIndex].y + offsets[actualIndex].y, chipSize, chipSize)
            }

        }
        // your turn indicator
        if (currentTurnPlayerID == sorted[i].id){
            let movedPos = Math.floor(Math.sin(gameTime) * 10);
            let offsets = {
                0: {
                    x: allCardsWidth / 2 - chipSize / 2,
                    y: scaledCardHeight + chipSize * 2.5 + movedPos,
                    angle: 180,
                },
                1: {
                    x: scaledCardHeight + chipSize * 2 + movedPos,
                    y: allCardsWidth / 2 + chipSize / 2,
                    angle: 90,

                },
                2: {
                    x: -chipSize * 3 + movedPos,
                    y: allCardsWidth / 2 + chipSize / 1.2,
                    angle: -90,
                }
            }
            G_ctx.save();
            G_ctx.translate(Math.floor(positions[actualIndex].x + offsets[actualIndex].x + chipSize / 2), Math.floor(positions[actualIndex].y + offsets[actualIndex].y - chipSize / 2));
            G_ctx.rotate(offsets[actualIndex].angle * Math.PI / 180);
            G_ctx.drawImage(atlas, 96, 48, 16, 16, -chipSize / 2, -chipSize / 2, chipSize, chipSize);
            G_ctx.restore();
        }
        // player color
        G_ctx.beginPath();
        G_ctx.fillStyle = sorted[i].color;
        let size = 16 * scale;
        let colorPos = {
            0: {
                x: positions[actualIndex].x-size,
                y: positions[actualIndex].y
            },
            1: {
                x: positions[actualIndex].x - size / 2,
                y: positions[actualIndex].y - size / 2
            },
            2: {
                x: positions[actualIndex].x+scaledCardHeight - size * 1.5,
                y: positions[actualIndex].y - size / 2
            },

        }
        G_ctx.fillRect(colorPos[actualIndex].x, colorPos[actualIndex].y, size, size);
        G_ctx.closePath();
        actualIndex++;
    }
}
function getHighestBet(){
    let highest = 0;
    for (let i = 0; i < players.length; i++){
        if (players[i].bet > highest) highest = players[i].bet;
    }
    return highest;
}
function clearBackground(){
    G_ctx.fillStyle = '#1d1d1d';
    G_ctx.fillRect(0, 0, G_canvas.width, G_canvas.height);
}
let lastTime = Date.now();
function gameLoop(){
    requestAnimationFrame(gameLoop);
    clearBackground();
    G_ctx.imageSmoothingEnabled = false;
    drawTableCards();
    drawPlayerCards();
    drawOtherPlayers();
    dt = Date.now() - lastTime;
    gameTime += 0.01 * dt;
    lastTime = Date.now();
    if (!sessionStorage.playerIDs) sessionStorage.setItem("playerIDs", player.id);
}
function getCard(points = 2, type = CARD_HEART){
    if (createdCards[points+"_"+type]) return createdCards[points+"_"+type];

    const canvas = new OffscreenCanvas(cardWidth, cardHeight);
    const ctx = canvas.getContext('2d');

    const atlas = loadedImages['poker.png'];

    if (points > 0){
        // card background
        ctx.drawImage(atlas, 0, 0);

        // card sign
        let signPositions = [
            {x: 16, y: 80}, // hearts
            {x: 0, y: 80},  // diamond
            {x: 0, y: 64},  // spade
            {x: 16, y: 64}, // club
        ];
        
        const signPos = signPositions[type];
        const signWidth = 16;
        const signHeight = 16;

        ctx.drawImage(atlas, signPos.x, signPos.y, signWidth, signHeight, 
                      Math.floor(cardWidth / 2 - signWidth / 2), Math.floor(cardHeight / 2 - signHeight / 2),
                      signWidth, signHeight
        );

        // card number
        let customNumberPos = {
            13: {x: 80, y: 80}
        }

        let numberX = (points - 1) % 6;
        let numberY = Math.floor((points - 1) / 6);

        let numberPos = {x: numberX * signWidth, y: 96 + numberY * signHeight};

        if (customNumberPos[points]) numberPos = customNumberPos[points];

        const colors = type < 2 ? loadedImages['poker_red'] : atlas;

        ctx.drawImage(colors, numberPos.x, numberPos.y, signWidth, signHeight, 0, 0, signWidth, signHeight);
        ctx.drawImage(colors, numberPos.x, numberPos.y, signWidth, signHeight, cardWidth - signWidth, cardHeight - signHeight - 1, signWidth, signHeight);

    }else{
        ctx.drawImage(atlas, -48, 0);
    }

    createdCards[points+"_"+type] = canvas;
    return canvas;
}
async function loadRedAtlas(){
    const canvas = new OffscreenCanvas(loadedImages['poker.png'].width, loadedImages['poker.png'].height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    ctx.drawImage(loadedImages['poker.png'], 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ed1c24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    loadedImages['poker_red'] = await createImageBitmap(canvas);
}
window.onload = async () => {
    await loadImages();
    await loadRedAtlas();
    testCard = getCard(0);
    gameLoop();
}

async function loadImages(){
    const images = ['poker.png'];
    const loadImage = async (name) => {
        return new Promise(resolve => {
            const image = new Image();
            image.src = 'imgs/'+name;
            image.onload = () => {
                resolve();
                loadedImages[name] = image;
            }
        });
    }

    for (let i = 0; i < images.length; i++){
        await loadImage(images[i]);
    }
}
window.addEventListener('resize', () => {
    G_canvas.width = document.body.offsetWidth;
    G_canvas.height = document.body.offsetHeight + 10;
    if (G_canvas.height < 700){
        scale = 2;
        scaledCardWidth = cardWidth * scale;
        scaledCardHeight = cardHeight * scale;
    }else{
        scale = 3;
        scaledCardWidth = cardWidth * scale;
        scaledCardHeight = cardHeight * scale;        
    }
});
function getChipsFromNumber(num){
    let newSum = num;

    let t = Math.floor(num / 1000);
    newSum -= t * 1000;
    let fiveh = Math.floor(newSum / 500);
    newSum -= fiveh * 500;
    let twof = Math.floor(newSum / 250);
    newSum -= twof * 250;
    let huns = Math.floor(newSum / 100);
    newSum -= huns * 100;

    if (newSum > 0) console.error('something went wrong');

    let chips = {
        1000: t,
        500: fiveh,
        250: twof,
        100: huns
    }
    return chips;
}
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key == ' '){
        matchBet();
    }
    if (key == 'f'){
        fold();
    }
});
function fold(){
    if (!player.hasFolded){
        player.hasFolded = true;
        socket.emit("fold");
    }
}
function matchBet(){
    let highest = getHighestBet();
    let betAmm = highest - player.bet;

    if (betAmm == 0) betAmm = 1000;
    betMoney(betAmm);
}