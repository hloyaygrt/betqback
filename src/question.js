class Question {
    constructor(id, part1, part2, part3, answer, idCategory) {
        this.id = id;
        this.part1 = part1;
        this.part2 = part2;
        this.part3 = part3;
        this.answer = answer;
        this.idCategory = idCategory;
    }
}

module.exports = Question;