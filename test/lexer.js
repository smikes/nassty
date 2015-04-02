'use strict';

var lexer = require('../lib/lexer.js');

var Code = require('code');
var Lab = require('lab');
var lab = Lab.script();
exports.lab = lab;

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

function expectEqualToken(a, b) {
    if (b.line) {
        expect(a.line).to.deep.equal(b.line);
        expect(a.column).to.deep.equal(b.column);
    }
    if (b.type) {
        expect(a.type).to.equal(b.type);
    }
    expect(a.data).to.equal(b.data);
    expect(a.data.length).to.equal(b.data.length);
}

function expectEqualTokens(l1, l2) {
    l1.map(function (a, i) {
        expectEqualToken(a, l2[i]);
    });
}

function logger() {
    var args = [].slice.call(arguments);
    process.stderr.write(args.join(""));
}

function expectLex(chunks, expected, done) {
    var l = lexer(),
//    var l = lexer({logger: LOG}),
        found = [];

    l.on('data', function (c) {
        found.push(c);
    });
    l.on('end', function () {
        expectEqualTokens(found, expected);
        done();
    });

    chunks.map(function (c) {
        l.write(c);
    });
    l.end();
}

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

    it('can log', function (done) {
        var called = false,
            l = lexer({logger: function () { called = true; }});

        l.on('end', function () {
            expect(called).to.equal(true);
            done();
        });

        l.write("\t\r\n");
        l.end();
    });

    it('identifies whitespace', function (done) {
        var l = lexer({});

        l.on('data', function (c) {
            expect(c.type).to.equal(lexer.S);
        });
        l.on('end', function () {
            done();
        });

        l.write(" \t\n\r\f");
        l.end();
    });

    var examples = [['identifies non-whitespace', [" a "],
                     [{data: ' ', line: 0, column: 0, type: lexer.S},
                      {data: 'a', line: 0, column: 1},
                      {data: ' ', line: 0, column: 2, type: lexer.S}]],

                    ['tracks location', ["a\na"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\n', line: 0, column: 1},
                      {data: 'a', line: 1, column: 0}]],

                    ['handles cr and lf', ["a\r", "\na"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\r\n', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 1, column: 0}]],

                    ['handles cr and cr', [ "a\r", "\ra" ],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\r\r', line: 0, column: 1, type: lexer.S },
                      {data: 'a', line: 2, column: 0} ]],

                    ['handles lf and lf', ["a\n\na"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\n\n', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 2, column: 0}]],

                    ['handles cr and spc', ["a\r a"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\r ', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 1, column: 1}]],

                    ['aggregates adjacent spc', ["a ", " a"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '  ', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 0, column: 3}]],

                    ['formfeed is newline', ["a", "\f", "a"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\f', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 1, column: 0}]],

                    ['formfeed+cr is two newlines', ["a", "\f", "\r", "a"],
                     [{data: 'a', line: 0, column: 0},
                      {data: '\f\r', line: 0, column: 1, type: lexer.S},
                      {data: 'a', line: 2, column: 0}]],

                    ['initial newline', ["\n\n"],
                     [{data: '\n\n', line: 0, column: 0, token: lexer.S}]],

                    ['lexes identifier "f"', ["f"],
                     [{data: 'f', type: lexer.IDENT}]],

                    ['lexes CSS comment', ["/* comment */"],
                     [{data: '/* comment */', type: lexer.COMMENT_ML}]],

                    ['lexes CSS comment (2)', ["/", "*\n", " comment ", "*/\n", "a"],
                     [{data: '/*\n comment */', type: lexer.COMMENT_ML},
                      {data: '\n'},
                      {data: 'a', line: 2, column: 0}]],

                    ['lexes CSS comment (3)', ["/", "*******\r\n", "*****  /** comment ", "*/\f", "a"],
                     [{data: '/*******\r\n*****  /** comment */', type: lexer.COMMENT_ML},
                      {data: '\f'},
                      {data: 'a', line: 2, column: 0}]],

                    ['lexes CSS comment (4)', ["/", "*\r\n", " comment ", "*/\n", "a"],
                     [{data: '/*\r\n comment */', type: lexer.COMMENT_ML},
                      {data: '\n'},
                      {data: 'a', line: 2, column: 0}]],


                    ['lexes single-line (SASS) comment', ["//"],
                     [{data: '//', type: lexer.COMMENT_SL}]],

                    ['lexes single-line (SASS) comment (2)', ["// "],
                     [{data: '// ', type: lexer.COMMENT_SL}]],

                    ['lexes single-line (SASS) comment (3)', ["// com", "ment", "\f", "a"],
                     [{data: '// comment\f', type: lexer.COMMENT_SL},
                      {data: 'a', type: lexer.IDENT}]],

                    ['lexes slash', ['/ '],
                     [{data: '/', type: lexer.SLASH},
                      {data: ' ', type: lexer.S}]],

                    ['lexes singlequoted string', ["'foo'"],
                     [{data: "'foo'", type: lexer.STRING_SQ}]],

                    ['lexes singlequoted string w/ escape', ["'f\\\\o\\'o'"],
                     [{data: "'f\\\\o\\'o'", type: lexer.STRING_SQ}]],

                    ['error: unterminated sq string', ["'foo\n"],
                     [{data: "'foo\n", type: lexer.UNTERMINATED_SQ}]],

                    ['error: unterminated sq string', ["'foo\r\n"],
                     [{data: "'foo\r", type: lexer.UNTERMINATED_SQ},
                      {data: "\n", type: lexer.S}]],

                    ['error: unterminated sq string', ["'foo\f"],
                     [{data: "'foo\f", type: lexer.UNTERMINATED_SQ}]],

                    ['lexes singlequoted string w/ escape (2)', ["'f\\", "a", "b o'"],
                     [{data: "'f\\ab o'", type: lexer.STRING_SQ}]],

                    ['lexes doublequoted string', ['"foo"'],
                     [{data: '"foo"', type: lexer.STRING_DQ}]],

                    ['lexes doublequoted string w/ escape', ['"f\\\\o\\"o"'],
                     [{data: '"f\\\\o\\"o"', type: lexer.STRING_DQ}]],

                    ['error: unterminated sq string', ['"foo\n'],
                     [{data: '"foo\n', type: lexer.UNTERMINATED_DQ}]],

                    ['error: unterminated sq string', ['"foo\r\n'],
                     [{data: '"foo\r', type: lexer.UNTERMINATED_DQ},
                      {data: "\n", type: lexer.S}]],

                    ['error: unterminated sq string', ['"foo\f'],
                     [{data: '"foo\f', type: lexer.UNTERMINATED_DQ}]],

                    ['lexes doublequoted string w/ escape (2)', ['"f\\', "a", 'b o"'],
                     [{data: '"f\\ab o"', type: lexer.STRING_DQ}]]




//                    ['lexes identifier "foo"', ["f", "oo"],
//                     [{data: 'foo', type: lexer.IDENT}]]

                   ];

    examples.map(function (lexeme) {
        it(lexeme[0], function (done) {
            expectLex(lexeme[1], lexeme[2], done);
        });
    });

});
