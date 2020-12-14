var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http,
    {
        cors: {
            origin: '*'
        }
    });

// system
var fs = require('fs');
const path = require('path');

const yandexCheckout = require('yandex-checkout')('768693', 'test_x6niBV_57TSdM83Xh3JX-umDn_RIA6WARIizYjF0ZBQ');

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
                            table.addPlayer(new Player(2, 10000, "c"), io);
                            table.removePlayer("c", io, null);
                            console.log('%j', table);

                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // // street 1
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.RAISE, 100), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.RAISE, 200), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.FOLD, 0), io));
                            // console.log(table.state, table.players);
                        }
                    }
                ).then(
                    function () {
                        if (LOCAL_TEST) {
                            // let table = databaseHelper.tables[0];
                            // let question = databaseHelper.questions[0];
                            // table.startGame(question, io);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CALL, 100), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // // street 1
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // // street 2
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // // street 3
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.CHECK, 0), io));
                            // console.log(table.gameState);
                            // // answer phase
                            // console.log(table.applyMoveForCurrentPlayer(Move.buildAnswerMove('kek'), io));
                            // console.log(table.gameState);
                            // console.log(table.applyMoveForCurrentPlayer(Move.buildAnswerMove('mda'), io));
                            // console.log(table.gameState);
                        }
                    }
                );
            }
        );
    }
);


setInterval(
    function () {
        for (let table of databaseHelper.tables) {
            let currentTs = +new Date();
            if (table.players.length > 1 && table.state === TABLE_STATE.STOP
                && currentTs - table.lastGameTs > 5000) {
                let question = databaseHelper.dealQuestionForTable(table);
                table.startGame(question, io);
            }
        }
    },
    2000
);

io.on('connection', function (socket) {
    console.log('one user connected ' + socket.id);

    socket.on('create payment', (request) => {
        yandexCheckout.createPayment({
            'amount':{
                'value': '1000.00',
                'currency': 'RUB',
            },
            'confirmation':{
                'type': 'embedded'
            }
        })
            .then((result) => {
                socket.emit('yandex kassa response', result.confirmation.confirmation_token)
            })
            .catch( err => console.log(err));
    });

    socket.on('find game', (request) => {
        console.log('searching table for player');
        console.log(request);

        if (request.enterCode !== '') {
            for (let table of databaseHelper.tables) {
                if (request.enterCode === table.enterCode &&
                    table.players.length !== table.maxPlayers) {
                    console.log(`Adding user ${request.userId} to table ${table.id}`);
                    socket.emit('table found');

                    table.addPlayer(new Player(request.userId, table.buyIn, socket.id), io);
                    return;
                }
            }
        } else {
            for (let table of databaseHelper.tables) {
                if (table.buyIn === request.buyIn &&
                    table.players.length !== table.maxPlayers) {
                    console.log(`Adding user ${request.userId} to table ${table.id}`);
                    socket.emit('table found');
                    table.addPlayer(new Player(request.userId, request.buyIn, socket.id), io);
                    return;
                }
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
                if (request.moveType.value === MOVE_TYPE.ANSWER.value) {
                    move = Move.buildAnswerMove(request.answer);
                } else {
                    move = new Move(request.moveType, request.bet);
                }
                console.log('move came : %j', move);
                let result = table.applyMoveForCurrentPlayer(move, io, databaseHelper);
                if (result.error) {
                    socket.emit('error processing move', result);
                }
                return;
            }
        }
        socket.emit('no table found');
    });

    socket.on('pipiping', () => {
        console.log('kek');
        socket.emit('popopong');
    });

    socket.on('create table', (request) => {
        console.log('Creating table ' + request);
        databaseHelper.createTable(request);
    });

    socket.on('leave table', () => {
        let res = 0;
        console.log('Leave table got ' + socket.id);
        for (let table of databaseHelper.tables) {
            res += table.removePlayer(socket.id, io, databaseHelper);
        }
        if (res === 0) {
            socket.emit('no table found');
        }
    });

    socket.on('get stats', (request) => {
        let userId = request.userId;
        databaseHelper.getSummaries(userId).then((snapshot) => {
            let val = snapshot.val();

            let listRes = [0];
            let x = [0];
            let cum = 0;
            let i = 0;

            for (let key in val) {
                cum += val[key].delta;
                listRes.push(cum);
                x.push(++i);
            }

            socket.emit('stats graph', {
                y: listRes,
                x: x
            });
        });
        databaseHelper.getTopPlayers().then((players) => {
            socket.emit('top players', {
               players: players.slice(0, 5)
            });
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');

        let res = 0;
        for (let table of databaseHelper.tables) {
            res += table.removePlayer(socket.id, io, databaseHelper);
        }
        if (res > 0) {
            console.log('Kicked him from ' + res + ' tables');
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

http.listen(3002, () => {
    console.log('listening on *:3002');
});