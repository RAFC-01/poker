const socket = io("http://localhost:3000");
const G_canvas = document.querySelector('canvas');
const G_ctx = G_canvas.getContext('2d');

G_canvas.width = innerWidth;
G_canvas.height = innerHeight + 10;

const createdCards = {};
const loadedImages = {};

let scale = 3;

let testCard;

const CARD_HEART = 0;
const CARD_DIAMOND = 1;
const CARD_SPADE = 2;
const CARD_CLUBS = 3;

const cardWidth = 38;
const cardHeight = 52;

let scaledCardWidth = cardWidth * scale;
let scaledCardHeight = cardHeight * scale;

const player = {
    hand: [],
    money: 5000,
    bet: 0
};

const chipPositions = {
    1000: {x: 48, y: 64},
    500: {x: 64, y: 64},
}

// let socket = {};

let players = [{
    id: 1,
    bet: {1000: 4, 500: 1},
    timeJoined: 123
}];

socket.on('connect', () => {
    console.log('connected!');
    socket.emit("getHand", {}, (res) => {
        player.hand = res.cards;
        players = res.players;
        socket.emit("addBet", {money: 1000}, (res) => {
            console.log(res.newMoney, res.bet);
        })
        socket.emit("addBet", {money: 500}, (res) => {
            console.log(res.newMoney, res.bet);
        })
    });
    socket.on("userJoin", (data) => {
        players = data;
    })
});


const cardsOnTable = [];
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
}
function drawPlayerCards(){
    let gap = 5;
    let allCardsWidth = (scaledCardWidth + gap) * player.hand.length;
    let cardsStartPos = Math.floor(G_canvas.width / 2 - allCardsWidth / 2); 

    for (let i = 0; i < player.hand.length; i++){
        const cardInfo = player.hand[i];
        const card = getCard(cardInfo.points, cardInfo.type);
        G_ctx.drawImage(card, cardsStartPos + i * (scaledCardWidth + gap), G_canvas.height - scaledCardHeight, scaledCardWidth, scaledCardHeight);
    }
}
function drawOtherPlayers(){
    const sorted = players.sort((a, b) => {
        a.timeJoined - b.timeJoined
    });
    const atlas = loadedImages['poker.png'];

    let gap = 5;
    let allCardsWidth = (scaledCardWidth + gap) * 2;
    let allCardsHeight = (scaledCardHeight + gap) * 2;

    let positions = [
        {x: Math.floor(G_canvas.width / 2 - allCardsWidth / 2), y: -10, angle: 0},
        {x: 10, y: Math.floor(G_canvas.height / 2 - allCardsHeight / 2), angle: 90},
        {x: G_canvas.width - scaledCardWidth - 10, y: Math.floor(G_canvas.height / 2 - allCardsHeight / 2), angle: -90},
    ];
    let actualIndex = 0;
    for (let i = 0; i < sorted.length; i++){
        if (sorted[i].id == socket.id) continue;
        // draw cards
        for (let j = 0; j < 2; j++){
            let gapX = positions[actualIndex].angle == 0 ? j * (scaledCardWidth + gap) : 0;
            let gapY = positions[actualIndex].angle !== 0 ? j * (scaledCardWidth + gap) : 0;
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
        const chips = Object.keys(sorted[i].bet);
        const chipSize = 16 * scale;
        for (let j = 0; j < chips.length; j++){
            const chip = chips[j];
            for (let k = 0; k < sorted[i].bet[chip]; k++){
                G_ctx.drawImage(atlas, chipPositions[chip].x, chipPositions[chip].y, 16, 16, positions[actualIndex].x + chipSize * j, positions[actualIndex].y + scaledCardHeight + 10 * k, chipSize, chipSize)
            }

        }
        actualIndex++;
    }
}
function clearBackground(){
    G_ctx.fillStyle = '#1d1d1d';
    G_ctx.fillRect(0, 0, G_canvas.width, G_canvas.height);
}

function gameLoop(){
    requestAnimationFrame(gameLoop);
    clearBackground();
    G_ctx.imageSmoothingEnabled = false;
    drawTableCards();
    drawPlayerCards();
    drawOtherPlayers();
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
})