var MOVE_TYPE = require('./move_type');

class Move {
    constructor(moveType, bet) {
        this.moveType = moveType;
        this.bet = bet;
        this.answer = null;
    }

    static buildAnswerMove(text) {
        let move = new Move(MOVE_TYPE.ANSWER, 0);
        move.answer = text;
        return move;
    }
}

module.exports = Move;