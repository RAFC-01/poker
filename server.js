const express = require('express');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {

});

const players = [];
let currentPlayerTurnId;
let gameInProgress = false;
let socketIds = {};
let gameStage = 0;
let tableCards = [];

io.on("connection", (socket) => {
    let currentSocketInfo;
    let lastPlayerID = socket.handshake.auth.playerID;
    // console.log(socketIds, lastPlayerID);
    if (lastPlayerID) socket.id = lastPlayerID;
    if (socketIds[lastPlayerID]) {
        console.log('found');
        currentSocketInfo = socketIds[lastPlayerID]; 
        players.push(currentSocketInfo.player);
    }else{
        console.log('not found');
        socketIds[socket.id] = {id: socket.id.toString(), secretInfo: socket.secretInfo, player: socket.player};
        socketIds[socket.id].player = {
            id: socketIds[socket.id].id.toString(),
            timeJoined: parseInt(Date.now()),
            hasFolded: false,
            bet: 0
        };
        socketIds[socket.id].secretInfo = {};
        players.push(socketIds[socket.id].player);
        currentSocketInfo = socketIds[socket.id];
    }
    players.sort((a, b) => a.timeJoined - b.timeJoined);
    console.log("user connected: ", currentSocketInfo.id);
    if (!currentPlayerTurnId) currentPlayerTurnId = currentSocketInfo.id;
    io.emit("currentTurn", currentPlayerTurnId);
    socket.on('getHand', (data, callback) => {
        if (!currentSocketInfo.hasCards){
            currentSocketInfo.player.money = 5000;
            const userCards = getCards(2);
            currentSocketInfo.secretInfo.cards = userCards;
            currentSocketInfo.hasCards = true;
        }

        socket.broadcast.emit("userJoin", players);

        if (callback) callback({cards: currentSocketInfo.secretInfo.cards, players: players, bet: currentSocketInfo.player.bet, table: tableCards})
    });
    socket.on("addBet", (data, callback) => {
        if (currentPlayerTurnId != currentSocketInfo.player.id && currentSocketInfo.player.firstBet) return;
        let betAmm = data.money;
        let correctBet = currentSocketInfo.player.bet;

        if (betAmm <= currentSocketInfo.player.money){
            currentSocketInfo.player.money -= betAmm;
            correctBet += betAmm;
            currentSocketInfo.player.bet = correctBet;

            socket.broadcast.emit("userJoin", players);
            gameInProgress = true;
            
            if (currentSocketInfo.player.firstBet){
                let nextPlayerIndex = getNextPlayerIndex();
                currentPlayerTurnId = players[nextPlayerIndex].id;
                io.emit("currentTurn", currentPlayerTurnId);
                if (checkAllPlayersEqual()){
                    goToNextGameStage(socket);
                }
            }
            
            currentSocketInfo.player.firstBet = true;
        }
        callback({newMoney: currentSocketInfo.player.money, bet: correctBet});
    });
    socket.on('disconnect', () => { 
        console.log('user disconnected: ', currentSocketInfo.id);
        const playerIndex = getPlayerByID(currentSocketInfo.id);

        // const playerCards = socketIds[socket.id].secretInfo?.cards;

        // cardPool.push(playerCards[0]);
        // cardPool.push(playerCards[1]);

        players.splice(playerIndex, 1);

        socket.broadcast.emit("userJoin", players);
    });
});

app.use(express.json());
app.use(express.static('public'));
function makeSureDirExists(path){
    if (!fs.existsSync(path)){
        fs.mkdirSync(path);
    }    
}
function getNextPlayerIndex(){
    let currentPlayerIndex = getPlayerByID(currentPlayerTurnId);
    return (currentPlayerIndex + 1) % players.length;
}
function goToNextGameStage(socket){
    gameStage++;
    if (gameStage == 1){
        revealTableCards(3, socket);
    }
    if (gameStage == 2){
        revealTableCards(1, socket);
    }
    if (gameStage == 3){
        revealTableCards(1, socket);
    }
}
function revealTableCards(amm, socket){
    let cards = getCards(amm);

    for (let i = 0; i < cards.length; i++){
        tableCards.push(cards[i]);
    }

    io.emit("tableCards", {cards: tableCards});
}
function checkAllPlayersEqual(){
    for (let i = 0; i < players.length; i++){
        if (players[i].bet !== players[0].bet && players[i].folded != true) return false;
    }
    return true;
}
function getPlayerByID(id){
    for (let i = 0; i < players.length; i++){
        if (players[i].id == id) return i;
    }
}
// Start
server.listen(PORT, () => {
  console.log(`Server działa na porcie ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

const cardPool = createRandomCardPool();

function createRandomCardPool(){
    const pool = [];
    for (let i = 0; i < 13; i++){
        for (let j = 0; j < 4; j++){
            pool.push({points: i + 1, type: j});
        }
    }
    return pool;
}
function getCards(amm){
    const cards = [];
    for (let i = 0; i < amm; i++){
        const cardIndex = Math.floor(Math.random() * cardPool.length);
        const card = cardPool[cardIndex];
        cardPool.splice(cardIndex, 1);
        cards.push(card); 
    }
    return cards;
}