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
let playerColors = ['red', 'yellow', 'blue', 'green'];

io.on("connection", (socket) => {
    let currentSocketInfo;
    let lastPlayerID = socket.handshake.auth.playerID;
    // console.log(socketIds, lastPlayerID);
    if (lastPlayerID) socket.id = lastPlayerID;
    if (socketIds[lastPlayerID]) {
        console.log('found');
        currentSocketInfo = socketIds[lastPlayerID]; 
        currentSocketInfo.socket = socket;
        players.push(currentSocketInfo.player);
    }else{
        console.log('not found');
        socketIds[socket.id] = {id: socket.id.toString(), secretInfo: socket.secretInfo, player: socket.player, socket: socket};
        socketIds[socket.id].player = {
            id: socketIds[socket.id].id.toString(),
            timeJoined: parseInt(Date.now()),
            hasFolded: false,
            bet: 0
        };
        socketIds[socket.id].secretInfo = {};
        players.push(socketIds[socket.id].player);
        currentSocketInfo = socketIds[socket.id];
        currentSocketInfo.player.color = playerColors[players.length - 1];
    }
    players.sort((a, b) => a.timeJoined - b.timeJoined);
    console.log("user connected: ", currentSocketInfo.id);
    if (!currentPlayerTurnId) currentPlayerTurnId = currentSocketInfo.id;
    io.emit("currentTurn", currentPlayerTurnId);
    socket.on('getHand', (data, callback) => {
        if (!currentSocketInfo.hasCards){
            currentSocketInfo.player.money = 5000;
            const userCards = getCards(2, true);
            currentSocketInfo.secretInfo.cards = userCards;
            currentSocketInfo.hasCards = true;
        }
        
        socket.broadcast.emit("userJoin", players);
        
        updateAllPlayersPoints();

        if (callback) callback({cards: currentSocketInfo.secretInfo.cards, players: players, bet: currentSocketInfo.player.bet, table: tableCards,
             folded: currentSocketInfo.player.hasFolded, color: currentSocketInfo.player.color})
    });
    socket.on("addBet", (data, callback) => {
        if (currentPlayerTurnId != currentSocketInfo.player.id && currentSocketInfo.player.firstBet) return;
        let betAmm = data.money;
        if (!betAmm || currentSocketInfo.player.hasFolded) return;
        let correctBet = currentSocketInfo.player.bet;

        if (betAmm <= currentSocketInfo.player.money){
            currentSocketInfo.player.money -= betAmm;
            correctBet += betAmm;
            currentSocketInfo.player.bet = correctBet;

            io.emit("userJoin", players);
            gameInProgress = true;
            
            if (currentSocketInfo.player.firstBet){
                let nextPlayerIndex = getNextPlayerIndex();
                currentPlayerTurnId = players[nextPlayerIndex].id;
                io.emit("currentTurn", currentPlayerTurnId);
                if (checkAllPlayersEqual()){
                    goToNextGameStage(socket, currentSocketInfo);
                }
            }
            
            currentSocketInfo.player.firstBet = true;
        }
        callback({newMoney: currentSocketInfo.player.money, bet: correctBet});
    });
    socket.on('fold', () => {
        currentSocketInfo.player.hasFolded = true;
        let nextPlayerIndex = getNextPlayerIndex();
        currentPlayerTurnId = players[nextPlayerIndex].id;
        io.emit("currentTurn", currentPlayerTurnId);
        if (checkAllPlayersEqual()){
            goToNextGameStage(socket, currentSocketInfo);
        }
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
    let index = currentPlayerIndex + 1;
    let maxI = players.length;
    let i = 0;
    while (players[index % players.length].hasFolded){
        index++;
        i++;
        if (i > maxI) return currentPlayerIndex;
    } 
    return index % players.length;
}
function goToNextGameStage(socket, user){
    gameStage++;
    if (gameStage == 1){
        revealTableCards(3, socket);
    }
    // if (gameStage == 2){
    //     revealTableCards(1, socket);
    // }
    // if (gameStage == 3){
    //     revealTableCards(1, socket);
    // }
    updateAllPlayersPoints();
    // checkPlayerPoints(user);
}
function revealTableCards(amm, socket){
    let cards = getStraight();//getCards(amm);

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
    return false;
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
            pool.push({points: i+1, type: j});
        }
    }
    return pool;
}
function getStraight(){
    return [
        {points: 9, type: 1},
        {points: 13, type: 2},
        {points: 12, type: 1},
        {points: 11, type: 1},
        {points: 10, type: 1},
    ];
}
function getCards(amm, user){
    const cards = [];
    for (let i = 0; i < amm; i++){
        const cardIndex = Math.floor(Math.random() * cardPool.length);
        const card = cardPool[cardIndex];
        card.isHand = user;
        cardPool.splice(cardIndex, 1);
        cards.push(card); 
    }
    return cards;
}
const cardValues = [
    {
        name: 'Royal Flush',
        sameSuit: true,
        minAmm: 5,
        cardValues: [1, 13, 12, 11, 10]
    },
    {
        name: 'Straight Flush',
        sameSuit: true,
        inOrder: true,
        cardValues: 0 // any
    },
    {
        name: 'Four Of A Kind',
        sameSuit: false,
        matchingCards: [4], 
        cardValues: 0 // any
    },
    {
        name: 'Full house',
        sameSuit: false,
        matchingCards: [3, 2], 
        cardValues: 0 // any
    },
    {
        name: 'Flush',
        sameSuit: true,
        minAmm: 5,
        cardValues: 0 // any
    },
    {
        name: 'Straight',
        sameSuit: false,
        inOrder: true,
        cardValues: 0 // any
    },        
    {
        name: 'Three of a kind',
        sameSuit: false,
        matchingCards: [3],
        cardValues: 0 // any
    },
    {
        name: 'Two pair',
        sameSuit: false,
        matchingCards: [2, 2],
        cardValues: 0 // any
    },         
    {
        name: 'Pair',
        sameSuit: false,
        matchingCards: [2],
        cardValues: 0 // any
    },         
    {
        name: 'High Card',
        sameSuit: false,
        cardValues: 0 // any
    },                  
];
function updateAllPlayersPoints(){
    for (let i = 0; i < players.length; i++){
        let points = checkPlayerPoints(socketIds[players[i].id]);
        socketIds[players[i].id].socket?.emit("cardsValue", {points: points});
    }
}
function getRealPoints(points){
    if (points == 1) return 14;
    else return points;
}
function checkPlayerPoints(user){
    let allCards = [];
    let cardPoints = 0;
    for (let i = 0; i < tableCards.length; i++){
        allCards.push(tableCards[i]);
    }
    if (user.hasCards){
        for (let i = 0; i < user.secretInfo.cards.length; i++){
            allCards.push(user.secretInfo.cards[i]);
            cardPoints += getRealPoints(user.secretInfo.cards[i].points);
        }
    }

    allCards.sort((a, b) => a.type - b.type);

    for (let i = 0; i < cardValues.length; i++){
        let found = false;
        let matchingCards = {};
        let sameSuit = !cardValues[i].sameSuit;
        let hasCardValues = true;
        let correctMatches = true;
        let addedPoints = 0;
        let minAmm = true; 
        if (cardValues[i].minAmm) minAmm = cardValues[i].minAmm <= allCards.length;
        let inOrder = {isTrue: true};
        if (cardValues[i].inOrder) inOrder = isFiveInOrder(allCards);
        let sameSuitAmm = 0;
        let currSameSuit = 1;

        let lastValueSuit;

        let cardValuesIncluded = 0;
        let sameSuitValues = 0;
        let seenSuitValues = {};

        for (let j = 0; j < allCards.length; j++){
            
            if (allCards[j].type == allCards[j-1]?.type) currSameSuit += 1;
            else currSameSuit = 1;

            if (currSameSuit > sameSuitAmm) sameSuitAmm = currSameSuit;

            matchingCards[allCards[j].points] == undefined ? matchingCards[allCards[j].points] = 1 : matchingCards[allCards[j].points]++;
        }

        if (cardValues[i].cardValues) hasCardValues = checkValues(allCards, cardValues[i].cardValues, cardValues[i].sameSuit);

        if (cardValues[i].sameSuit && cardValues[i].minAmm <= sameSuitAmm) sameSuit = true;

        console.log(sameSuitValues);

        // check matching cards
        if (cardValues[i].matchingCards){
            let matchingCardsKeys = Object.keys(matchingCards); 
            console.log(matchingCards)
            for (let j = 0; j < cardValues[i].matchingCards.length; j++){
                let amm = cardValues[i].matchingCards[j];
                let matchFound = false;
                for (let k = matchingCardsKeys.length-1; k >= 0; k--){
                    let key = matchingCardsKeys[k];
                    let ammValue = matchingCards[key];
                    if (ammValue >= amm){
                        matchFound = true;
                        delete matchingCards[key];
                        addedPoints += amm * getRealPoints(key);
                        break;
                    }
                }
                if (!matchFound) {
                    correctMatches = false;
                    break;
                }
            }
        }

        
        if (inOrder.points) {
            addedPoints += inOrder.points;
            console.log(inOrder);
            if (cardValues[i].sameSuit) sameSuit = inOrder.sameSuit;
        }
        console.log({name: cardValues[i].name, sameSuit, hasCardValues, correctMatches, inOrder: inOrder.isTrue, minAmm})

        if (sameSuit && hasCardValues && correctMatches && inOrder.isTrue && minAmm) found = true;

        if (found || i == cardValues.length - 1) return {value: cardValues[i], points: addedPoints, handPoints: cardPoints};
    }
}
function checkValues(cards = [], required = [], sameSuit = true){
    if (cards.length < 5) return false;
    let seenPoints = {};
    let foundType = {};
    let found = 0;
    for (let i = 0; i < cards.length; i++){
        let seen = false;
        for (let j = 0; j < required.length; j++){
            if (cards[i].points == required[j]){
                seen = true;
                break;
            }
        }
        if (!seen) continue;
        if (!seenPoints[cards[i].points] || !foundType[cards[i].type]){
            if (sameSuit){
                foundType[cards[i].type] ? foundType[cards[i].type]++ : foundType[cards[i].type] = 1;
                if (found < foundType[cards[i].type]) found = foundType[cards[i].type]; 
            }else{
                found++;
            }
        }
        seenPoints[cards[i].points] = 1;
    }
    console.log(foundType);
    if (required.length <= found) return true;
    return false;
}
function isFiveInOrder(cards = []){
    const currCard = cards.slice(0, cards.length); // copy not reference
    if (currCard.length < 5) return false;
    for (let i = 0; i < currCard.length; i++){
        if (currCard[i].points == 1) currCard.push({points: 14, type: currCard[i].type});
    }
    currCard.sort((a, b) => a.points - b.points);
    console.log(currCard);
    let streak = 1;
    let highestStreak = 0;
    let last = -1;
    let pointsTotal = 0;
    let currPoints = 0;
    let isHighSameSuit = false;
    let currSameSuit = {};
    for (let i = 0; i < currCard.length; i++){
        if (!currSameSuit[currCard[i].type]) currSameSuit[currCard[i].type] = 1;
        console.log(currCard[i]);
        if (currCard[i].points - 1 == last){
            streak++;
            currPoints += getRealPoints(currCard[i].points);
            currSameSuit[currCard[i].type] ? currSameSuit[currCard[i].type]++ : currSameSuit[currCard[i].type] = 1;
            if (currSameSuit[currCard[i].type] > isHighSameSuit) isHighSameSuit = currSameSuit[currCard[i].type];
            console.log(currCard[i])
        }else{
            if (currCard[i].points !== last){
                streak = 1;
                currPoints = 0;
            } 
        } 
        if (streak > highestStreak) {
            highestStreak = streak;
        }
        console.log(isHighSameSuit);
        if (currPoints > pointsTotal) pointsTotal = currPoints;
        last = currCard[i].points;
    }
    console.log({currSameSuit, currCard});
    return { isTrue: highestStreak >= 5, points: pointsTotal, sameSuit: isHighSameSuit };
}