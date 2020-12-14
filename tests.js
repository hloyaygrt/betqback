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


function testRemovingPlayer() {
    let table = databaseHelper.tables[0];
    let question = databaseHelper.questions[0];
    table.addPlayer(new Player(0, 10000, "a"), io);
    table.addPlayer(new Player(1, 10000, "b"), io);
    table.startGame(question, io);
    table.addPlayer(new Player(2, 10000, "c"), io);
    table.removePlayer("c", io, null);
    console.log('%j', table);
    table.removePlayer("a", io, null);
    table.removePlayer("b", io, null);
}

function testFullGame() {
    let table = databaseHelper.tables[0];
    let question = databaseHelper.questions[0];
    // table.addPlayer(new Player(0, 10000, "a"), io);
    // table.addPlayer(new Player(1, 10000, "b"), io);
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

databaseHelper.loadCategories().then(
    function () {
        databaseHelper.loadQuestions().then(
            function () {
                databaseHelper.loadTables().then(
                    () => testRemovingPlayer()
                ).then(
                    () => testFullGame()
                ).then(() => {
                    process.exit(0);
                })
            }
        );
    }
)
