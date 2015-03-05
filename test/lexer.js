'use strict';

var lexer = require('../lib/lexer.js');

var Code = require('code');
var Lab = require('lab');
var lab = Lab.script();
exports.lab = lab;

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('lexer', function () {
    it('is a function', function (done) {
        expect(lexer).to.be.instanceof(Function);
        done();
    });

    it('returns a stream', function (done) {
        var l = lexer();

        l.on('end', function () {
            done();
        });

        l.end();
    });

    it('identifies whitespace', function (done) {
        var l = lexer();

        l.on('data', function (c) {
            expect(c.type).to.equal(lexer.S);
        });
        l.on('end', function () {
            done();
        });

        l.write(" \t\n\r\f");
        l.end();
    });

    it('identifies non-whitespace', function (done) {
        var l = lexer(),
            expected = [ {data: ' ', type: lexer.S},
                         {data: 'a'},
                         {data: ' ', type: lexer.S} ],
            i = 0;

        l.on('data', function (c) {
            expect(c.data).to.deep.equal(expected[i].data);
            expect(c.type).to.deep.equal(expected[i].type);
            i += 1;
        });
        l.on('end', function () {
            expect(i).to.equal(3);
            done();
        });

        l.write(" a ");
        l.end();
    });

    it('tracks location', function (done) {
        var l = lexer(),
            expected = [ {data: 'a', line: 0, column: 0},
                         {data: '\n', line: 0, column: 1},
                         {data: 'a', line: 1, column: 0} ],
            i = 0;


        l.on('data', function (c) {
            expect(c.data).to.deep.equal(expected[i].data);
            expect(c.line).to.deep.equal(expected[i].line);
            expect(c.column).to.deep.equal(expected[i].column);
            i += 1;
        });
        l.on('end', function () {
            expect(i).to.equal(3);
            done();
        });

        l.write("a\na");
        l.end();
    });

});

