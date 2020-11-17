// socket io
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

// system
var fs = require('fs');
const path = require('path');

// firebase
var fb = require("firebase/app");
var database = require("firebase/database");

var Table = require("./src/table");
var Question = require("./src/question");
var Category = require("./src/category");
var TABLE_STATE = require("./src/table_state")
var DatabaseHelper = require("./src/db_helper");
var Player = require("./src/player");
var Move = require('./src/move');
var MOVE_TYPE = require('./src/move_type');


var firebaseConfig = {
    apiKey: "AIzaSyBYDgS9o2qdSOf1gggKVm73TJfYO0l8G0A",
    authDomain: "bet-quiz.firebaseapp.com",
    databaseURL: "https://bet-quiz.firebaseio.com",
    projectId: "bet-quiz",
    storageBucket: "bet-quiz.appspot.com",
    messagingSenderId: "101757424486",
    appId: "1:101757424486:web:d41822a3739d019ec1eea7",
    measurementId: "G-WD1TB82DSD"
};
fb.initializeApp(firebaseConfig);

let databaseHelper = new DatabaseHelper(fb.database());
let LOCAL_TEST = false;

databaseHelper.loadCategories().then(
    function () {
        databaseHelper.loadQuestions().then(
            function () {
                databaseHelper.loadTables().then(
                    function () {
                        if (LOCAL_TEST) {
                            let table = databaseHelper.tables[0];
                            let question = databaseHelper.questions[0];
                            table.addPlayer(new Player(0, 10000, "a"), io);
                            table.addPlayer(new Player(1, 10000, "b"), io);
                            table.startGame(question, io);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CALL, 100), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            // street 1
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.RAISE, 100), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.RAISE, 200), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.FOLD, 0), io));
                            console.log(table.state, table.players);
                        }
                    }
                ).then(
                    function () {
                        if (LOCAL_TEST) {
                            let table = databaseHelper.tables[0];
                            let question = databaseHelper.questions[0];
                            table.startGame(question, io);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CALL, 100), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            // street 1
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            // street 2
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            // street 3
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            console.log(table.gameState);
                            // answer phase
                            console.log(table.applyMoveForCurrentPlayer(Move.buildAnswerMove('kek'), io));
                            console.log(table.gameState);
                            console.log(table.applyMoveForCurrentPlayer(Move.buildAnswerMove('mda'), io));
                            console.log(table.gameState);
                        }
                    }
                );
            }
        );
    }
);

if (!LOCAL_TEST) {
    setInterval(
        function () {
            for (let table of databaseHelper.tables) {
                if (table.players.length > 1 && table.state === TABLE_STATE.STOP) {
                    console.log('STARTING GAME ON table ' + table.id);
                    let question = databaseHelper.dealQuestionForTable(table);
                    table.startGame(question, io);
                }
            }
        },
        2000
    );
}

io.on('connection', function (socket) {
    console.log('one user connected ' + socket.id);

    socket.on('find game', (request) => {
        console.log('searching table for player');
        console.log(request);

        for (let table of databaseHelper.tables) {
            if (table.buyIn === request.buyIn &&
                (request.enterCode === '' || request.enterCode === table.enterCode) &&
                table.players.length !== table.maxPlayers &&
                table.state !== TABLE_STATE.RUNNING) {
                console.log(`Adding user ${request.userId} to table ${table.id}`);
                table.addPlayer(new Player(request.userId, request.buyIn, socket.id), io);
                return;
            }
        }

        socket.emit('no table found');
    });

    socket.on('move', (request) => {
        for (let table of databaseHelper.tables) {
            if (table.id === request.tableId) {
                if (table.state !== TABLE_STATE.RUNNING) {
                    socket.emit('table is not running');
                    return;
                }
                if (table.getCurrentPlayer().token !== socket.id) {
                    socket.emit('not your move now');
                    return;
                }
                let move = null;
                if (request.moveType === MOVE_TYPE.ANSWER) {
                    move = Move.buildAnswerMove(request.answer);
                } else {
                    move = new Move(request.moveType, request.bet);
                }
                let result = table.applyMoveForCurrentPlayer(move, io);
                if (result.error) {
                    socket.emit('error processing move', result);
                }
                return;
            }
        }
        socket.emit('no table found');
    });

    socket.on('ping', (request) => {
        socket.emit('pong');
    });

    socket.on('leave table', (request) => {
        for (let table of databaseHelper.tables) {
            if (table.id === request.tableId) {
                if (table.state === TABLE_STATE.STOP) {
                    if (!table.removePlayer(socket.id, io)) {
                        socket.emit('wrong tableId');
                    } else {
                        socket.emit('table left');
                    }
                } else {
                    console.log('cant remove player from running table :(');
                }
                return;
            }
        }
        socket.emit('no table found');
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});