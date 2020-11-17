var Table = require('./table');
var Question = require('./question');
var Category = require('./category');

class DatabaseHelper {
    constructor(firebase) {
        this.database = firebase;
        this.tables = [];
        this.questions = [];
        this.categories = [];
    }

    loadTables() {
        let self = this;
        return this.database.ref('/tables/').once('value').then(function (snapshot) {
            for (let tableRef of snapshot.val()) {
                let table = new Table(tableRef.id, tableRef.buy_in, tableRef.max_players,
                    tableRef.enter_code);
                console.log(table);
                self.tables.push(table);
            }
        });
    }

    loadQuestions() {
        let self = this;
        return this.database.ref('/questions/').once('value').then(function (snapshot) {
            for (let questionRef of snapshot.val()) {
                let question = new Question(questionRef.id, questionRef.part1, questionRef.part2,
                    questionRef.part3, questionRef.answer, questionRef.id_category);
                console.log(question);
                self.questions.push(question);
            }
        });
    }

    loadCategories() {
        let self = this;
        return this.database.ref('/categories/').once('value').then(function (snapshot) {
            for (let categoriesRef of snapshot.val()) {
                let category = new Category(categoriesRef.id, categoriesRef.name,
                    categoriesRef.description);
                console.log(category);
                self.categories.push(category);
            }
        });
    }

    dealQuestionForTable(table) {
        return this.questions[Math.floor(Math.random() * this.questions.length)];
    }
}

module.exports = DatabaseHelper;