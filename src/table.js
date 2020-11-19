var TABLE_STATE = require('./table_state');
var MOVE_TYPE   = require('./move_type');
var Move        = require('./move');

class GameState {
    constructor(playersCnt) {
        this.playersCnt = playersCnt;
        this.dealerPos = Math.floor(Math.random() * this.playersCnt);
        this.currentPlayer = (this.dealerPos + 1) % this.playersCnt;
        this.streetNum = 0;
        this.hasFolded = new Array(playersCnt).fill(0);
        this.lastRaiseBet = 0;
        this.bets = new Array(playersCnt).fill(0);
        this.bank = 0;
        this.hasPlayedThisStreet = new Array(playersCnt).fill(0);
        this.betPhaseEnded = false;
        this.answers = new Array(playersCnt).fill(null);
    }

    increaseStreet() {
        this.currentPlayer = this.nextActivePlayer(this.dealerPos);
        this.streetNum += 1;
        this.lastRaiseBet = 0;
        this.bets = new Array(this.playersCnt).fill(0);
        this.hasPlayedThisStreet = new Array(this.playersCnt).fill(0);
    }

    nextActivePlayer(pos) {
        pos = (pos + 1) % this.playersCnt;
        while (this.hasFolded[pos]) {
            pos = (pos + 1) % this.playersCnt;
        }
        return pos;
    }

    prevActivePlayer(pos) {
        pos = (pos - 1 + this.playersCnt) % this.playersCnt;
        while (this.hasFolded[pos]) {
            pos = (pos + 1) % this.playersCnt;
        }
        return pos;
    }

    activePlayers() {
        return this.playersCnt - this.hasFolded.reduce((a, b) => a + b, 0);
    }

    allPlayerHaveAnswers() {
        for (let i = 0; i < this.playersCnt; i++) {
            if (!this.hasFolded[i] && this.answers[i] === null) {
                return false;
            }
        }
        return true;
    }

    removePlayer(pos) {
        this.playersCnt -= 1;
        this.hasFolded.splice(pos, 1);
        this.bets.splice(pos, 1);
        this.hasPlayedThisStreet.splice(pos, 1);
        this.answers.splice(pos, 1);

        if (this.currentPlayer >= pos) {
            this.currentPlayer -= 1;
        }
        if (this.dealerPos >= pos) {
            this.dealerPos -= 1;
        }
    }
}

class Table {
    constructor(id, buyIn, maxPlayers, enterCode) {
        this.id = id;
        this.players = [];
        this.state = TABLE_STATE.STOP;
        this.gameState = null;
        this.buyIn = buyIn;
        this.maxPlayers = maxPlayers;
        this.enterCode = enterCode;
        this.currentQuestion = null;
        this.lastGameTs = +new Date();
    }

    addPlayer(player, io) {
        if (player.stack !== this.buyIn) {
            console.log('Player joined without buyin');
        }
        this.players.push(player);

        for (let player of this.players) {
            io.to(player.token).emit('player joined', {
                table: this
            });
        }
    }

    removePlayer(token, io, database) {
        if (this.state === TABLE_STATE.RUNNING) {
            let pos = null;
            for (let i = 0; i < this.players.length; i++) {
                if (this.players[i].token === token) {
                    pos = i;
                }
            }

            console.log('Removing from table player on pos ' + pos);

            if (pos === null) {
                return false;
            }

            if (pos < this.gameState.playersCnt) {
                if (this.gameState.activePlayers() === 2) {
                    // game is ended
                    let winners = [];
                    for (let i = 0; i < this.gameState.playersCnt; i++) {
                        if (!this.gameState.hasFolded[i] && i !== pos) {
                            winners.push(i);
                        }
                    }
                    console.assert(winners.length === 1);
                    this.endGameWithWinners(winners, io, database);
                    this.gameState.removePlayer(pos);
                    this.players.splice(pos, 1);
                    this.initialStacks.splice(pos, 1);
                    return true;
                }
                if (pos === this.gameState.dealerPos) {
                    this.gameState.dealerPos = this.gameState.prevActivePlayer(pos);
                }
                if (pos === this.gameState.currentPlayer) {
                    this.gameState.currentPlayer = this.gameState.nextActivePlayer(pos);
                }

                if (database !== null) {
                    let delta = this.players[pos].stack - this.initialStacks[pos];
                    database.handSummary(this.players[pos].id, delta, this.currentQuestion);
                } else {
                    console.log('CANT WRITE HS');
                }

                this.initialStacks.splice(pos, 1);
                this.gameState.removePlayer(pos);
                this.players.splice(pos, 1);

                this.updateStreetNum();
                if (this.gameState.betPhaseEnded && this.gameState.allPlayerHaveAnswers()) {
                    this.determineWinnersAndEnd(io, database);
                    return true;
                }
            } else {
                this.players.splice(pos, 1);
            }

            for (let player of this.players) {
                io.to(player.token).emit('update table', {
                    table: this
                });
            }
            return true;
        } else {
            for (let i = 0; i < this.players.length; i++) {
                if (this.players[i].token === token) {
                    this.players.splice(i, 1);
                    for (let player of this.players) {
                        io.to(player.token).emit('player joined', {
                            table: this
                        });
                    }
                    return true;
                }
            }
        }
        return false;
    }

    updateStreetNum() {
        let pos = this.gameState.currentPlayer;
        if (!this.gameState.betPhaseEnded && this.gameState.hasPlayedThisStreet[pos] &&
            this.gameState.bets[pos] === this.gameState.lastRaiseBet) {
            // street finished
            if (this.gameState.streetNum === 3) {
                this.gameState.betPhaseEnded = true;
            } else {
                this.gameState.increaseStreet();
            }
        }
    }

    determineWinnersAndEnd(io, database) {
        let winners = [];
        for (let i = 0; i < this.gameState.playersCnt; i++) {
            if (!this.gameState.hasFolded[i] &&
                this.gameState.answers[i].toLowerCase() === this.currentQuestion.answer.toLowerCase()) {
                winners.push(i);
            }
        }
        if (winners.length === 0) {
            // all are winners
            for (let i = 0; i < this.gameState.playersCnt; i++) {
                if (!this.gameState.hasFolded[i]) {
                    winners.push(i);
                }
            }
        }
        this.endGameWithWinners(winners, io, database);
    }

    startGame(question, io) {
        if (this.state === TABLE_STATE.RUNNING) {
            console.log(`table ${this.id} is already running`);
            return false;
        }
        if (this.players.length <= 1) {
            console.log(`table ${this.id} has not enough players`);
            return false;
        }

        this.state = TABLE_STATE.RUNNING;
        console.log(`STARTING GAME ON TABLE ${this.id}`);

        // here we need to
        // 0) pick a dealer pos V
        // 1) pick a question   V
        // 2) emit to all the players the game stated (with dealer pos)
        // 3) emit small blind and big blind, change the stakes

        this.currentQuestion = question;
        this.gameState = new GameState(this.players.length);
        this.initialStacks = [];
        for (let i = 0; i < this.players.length; i++) {
            this.initialStacks.push(this.players[i].stack);
        }

        this.emitState(io);
        this.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.BLIND, 50), io);
        this.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.BLIND, 100), io);
        return true;
    }

    endGameWithWinners(winners, io, database) {
        if (this.state !== TABLE_STATE.RUNNING) {
            console.log(`table ${this.id} is not running`);
            return false;
        }
        console.log('ENDING GAME ON TABLE ' + this.id + ' with winners ' + winners)
        let split = this.gameState.bank / winners.length >> 0;
        for (let i = 0; i < this.gameState.playersCnt; i++) {
            if (winners.indexOf(i) !== -1) {
                this.players[i].stack += split;
            }
        }
        this.lastGameTs = +new Date();
        this.state = TABLE_STATE.STOP;
        for (let player of this.players) {
            io.to(player.token).emit('hand ended', {
                 'table': this,
                 'winners': winners
            });
        }

        if (database !== null) {
            // here write hand stats
            for (let i = 0; i < this.gameState.playersCnt; i++) {
                let delta = this.players[i].stack - this.initialStacks[i];
                database.handSummary(this.players[i].id, delta, this.currentQuestion);
            }
        } else {
            console.log('CANT WRITE HS');
        }

        return true;
    }

    emitState(io) {
        for (let player of this.players) {
            io.to(player.token).emit('update table', {
                'table': this
            });
        }
    }

    getCurrentPlayer() {
        return this.players[this.gameState.currentPlayer];
    }

    applyMoveForCurrentPlayer(move, io, database) {
        // with validation please
        // emit to all the hand after move
        let pos = this.gameState.currentPlayer;

        if (move.moveType.value !== MOVE_TYPE.BLIND.value) {
            this.gameState.hasPlayedThisStreet[pos] = 1;
        }

        if (move.moveType.value !== MOVE_TYPE.ANSWER.value && this.gameState.betPhaseEnded) {
            return {
                error: true,
                msg: 'betting phase already finished, please provide answers'
            };
        }

        switch (move.moveType.value) {
            case MOVE_TYPE.BLIND.value:
                if (this.gameState.streetNum !== 0) {
                    return {
                        error: true,
                        msg: 'blind in the middle of the game?'
                    };
                }
                this.gameState.bank += move.bet - this.gameState.bets[pos];
                this.players[pos].stack -= move.bet - this.gameState.bets[pos];
                this.gameState.lastRaiseBet = move.bet;
                this.gameState.bets[pos] = move.bet;
                break;
            case MOVE_TYPE.CALL.value:
                if (move.bet !== this.gameState.lastRaiseBet) {
                    return {
                        error: true,
                        msg: `calling with ${move.bet} while last bet is ${this.gameState.lastRaiseBet}`
                    };
                }
                this.gameState.bank += move.bet - this.gameState.bets[pos];
                this.players[pos].stack -= move.bet - this.gameState.bets[pos];
                this.gameState.bets[pos] = move.bet;
                break;
            case MOVE_TYPE.RAISE.value:
                if (move.bet <= this.gameState.lastRaiseBet) {
                    return {
                        error: true,
                        msg: `raising with ${move.bet} while last bet is ${this.gameState.lastRaiseBet}`
                    };
                }
                console.log('RAISING ', move.bet);
                this.gameState.bank += move.bet - this.gameState.bets[pos];
                this.players[pos].stack -= move.bet - this.gameState.bets[pos];
                this.gameState.bets[pos] = move.bet;
                this.gameState.lastRaiseBet = move.bet;
                break;
            case MOVE_TYPE.CHECK.value:
                if (move.bet !== 0) {
                    return {
                        error: true,
                        msg: `checking with ${move.bet}`
                    };
                }
                if (this.gameState.lastRaiseBet !== this.gameState.bets[pos]) {
                    return {
                        error: true,
                        msg: `current call is ${this.gameState.lastRaiseBet}, check is not available`
                    };
                }
                break;
            case MOVE_TYPE.FOLD.value:
                this.gameState.hasFolded[pos] = 1;
                break;
            case MOVE_TYPE.ANSWER.value:
                if (!this.gameState.betPhaseEnded) {
                    return {
                        error: true,
                        msg: 'bettign phase didnt ended, i dont need your answer'
                    }
                }
                this.gameState.answers[pos] = move.answer;
                break;
            default:
                return {
                    error: true,
                    msg: 'unknown move type'
                };
                break;
        }

        if (this.gameState.activePlayers() === 1) {
            // all except one folded
            for (let i = 0; i < this.gameState.playersCnt; i++) {
                if (!this.gameState.hasFolded[i]) {
                    // this player won
                    this.endGameWithWinners([i], io, database);
                    return {
                        error: false
                    };
                }
            }
        }

        this.gameState.currentPlayer = this.gameState.nextActivePlayer(pos);
        this.updateStreetNum();

        if (this.gameState.betPhaseEnded && this.gameState.allPlayerHaveAnswers()) {
            this.determineWinnersAndEnd(io, database);
            return {
                error: false
            };
        }

        console.log('TABLE = %j', this);
        this.emitState(io);
        return {
            error: false
        };
    }
}

module.exports = Table;
