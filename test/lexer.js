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

    it('identifies whitespace', function (done) {
        var l = lexer(),
            expected = [ {data: ' ', type: lexer.S},
                         {data: 'a'},
                         {data: ' ', type: lexer.S} ],
            i = 0;

        l.on('data', function (c) {
            expect(c).to.deep.equal(expected[i]);
            i += 1;
        });
        l.on('end', function () {
            done();
        });

        l.write(" a ");
        l.end();
    });

});

