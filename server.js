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

io.on("connection", (socket) => {
    console.log("user connected: ", socket.id);
    socket.player = {
        id: socket.id,
        timeJoined: Date.now(),
        bet: {}
    };
    socket.secretInfo = {};
    players.push(socket.player);
    socket.on('getHand', (data, callback) => {
        socket.player.money = 5000;
        const userCards = getCards(2);
        socket.secretInfo.cards = userCards;

        socket.broadcast.emit("userJoin", players);

        if (callback) callback({cards: userCards, players: players})
    });
    socket.on("addBet", (data, callback) => {
        let betAmm = data.money;
        let correctBet = 0;
        if (betAmm < socket.player.money){
            socket.player.money -= betAmm;
            correctBet = betAmm;
            if (!socket.player.bet[betAmm]) socket.player.bet[betAmm] = 4;
            else socket.player.bet[betAmm]+=4;
            socket.broadcast.emit("userJoin", players);
        }
        callback({newMoney: socket.player.money, bet: correctBet});
    })
    socket.on('disconnect', () => { 
        console.log('user disconnected: ', socket.id);
        const playerIndex = getPlayerByID(socket.id);

        const playerCards = socket.secretInfo?.cards;

        cardPool.push(playerCards[0]);
        cardPool.push(playerCards[1]);

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