var TABLE_STATE = require('./table_state');
var MOVE_TYPE   = require('./move_type');
var Move        = require('./move');

class GameState {
    constructor(playersCnt) {
        this.playersCnt = playersCnt;
        this.dealerPos = 0; // todo change
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

    removePlayer(token, io) {
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
        return false;
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

        this.emitState(io);
        this.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.BLIND, 50), io);
        this.applyMoveForCurrentPlayer(new Move(MOVE_TYPE.BLIND, 100), io);
        return true;
    }

    endGameWithWinners(winners, io) {
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
        this.state = TABLE_STATE.STOP;
        for (let player of this.players) {
            io.to(player.token).emit('hand ended', {
                 'table': this
            });
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

    applyMoveForCurrentPlayer(move, io) {
        // with validation please
        // emit to all the hand after move
        let pos = this.gameState.currentPlayer;

        if (move.moveType !== MOVE_TYPE.BLIND) {
            this.gameState.hasPlayedThisStreet[pos] = 1;
        }

        if (move.moveType !== MOVE_TYPE.ANSWER && this.gameState.betPhaseEnded) {
            return {
                error: true,
                msg: 'betting phase already finished, please provide answers'
            };
        }

        switch (move.moveType) {
            case MOVE_TYPE.BLIND:
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
            case MOVE_TYPE.CALL:
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
            case MOVE_TYPE.RAISE:
                if (move.bet <= this.gameState.lastRaiseBet) {
                    return {
                        error: true,
                        msg: `raising with ${move.bet} while last bet is ${this.gameState.lastRaiseBet}`
                    };
                }
                this.gameState.bank += move.bet - this.gameState.bets[pos];
                this.players[pos].stack -= move.bet - this.gameState.bets[pos];
                this.gameState.bets[pos] = move.bet;
                this.gameState.lastRaiseBet = move.bet;
                break;
            case MOVE_TYPE.CHECK:
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
            case MOVE_TYPE.FOLD:
                this.gameState.hasFolded[pos] = 1;
                break;
            case MOVE_TYPE.ANSWER:
                if (!this.gameState.betPhaseEnded) {
                    return {
                        error: true,
                        msg: 'bettign phase didnt ended, i dont need your answer'
                    }
                }
                this.gameState.answers[pos] = move.answer;
                break;
        }

        if (this.gameState.activePlayers() === 1) {
            // all except one folded
            for (let i = 0; i < this.gameState.playersCnt; i++) {
                if (!this.gameState.hasFolded[i]) {
                    // this player won
                    this.endGameWithWinners([i], io);
                    return {
                        error: false
                    };
                }
            }
        }

        pos = this.gameState.nextActivePlayer(pos);
        if (!this.gameState.betPhaseEnded && this.gameState.hasPlayedThisStreet[pos] &&
            this.gameState.bets[pos] === this.gameState.lastRaiseBet) {
            // street finished
            if (this.gameState.streetNum === 3) {
                this.gameState.betPhaseEnded = true;
                this.gameState.currentPlayer = pos;
            } else {
                this.gameState.increaseStreet();
            }
        } else {
            // streetContinue
            this.gameState.currentPlayer = pos;
        }

        if (this.gameState.betPhaseEnded && this.gameState.allPlayerHaveAnswers()) {
            let winners = [];
            for (let i = 0; i < this.gameState.playersCnt; i++) {
                if (!this.gameState.hasFolded[i] && this.gameState.answers[i] === this.currentQuestion.answer) {
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
            this.endGameWithWinners(winners, io);
            return {
                error: false
            };
        }

        this.emitState(io);
        return {
            error: false
        };
    }
}

module.exports = Table;
