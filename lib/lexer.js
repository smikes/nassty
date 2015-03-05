'use strict';

var through = require('through'),
    re_S = /[ \t\r\n\f]/,
    S = {};

function lexer() {

    var line = 0,
        column = -1,
        tok,
        stream;

    function makeToken(char, type) {
        if (tok) {
            tok.data += char;
            return tok;
        }

        tok = {
            line: line,
            column: column,
            data: char,
            type: type
        };
    }
    function useToken() {
        var t = tok;
        stream.queue(t);
        tok = undefined;
    }

    stream = through(function (chunk) {

        Array.prototype.map.call(String(chunk), function (char) {
            column += 1;

            if (char === '\n') {
                makeToken(char, S);
                line += 1;
                column = -1;
                return useToken();
            } else if (char.match(re_S)) {
                makeToken(char, S);
                return useToken();
            }
            makeToken(char);
            return useToken();
        });
    });

    return stream;
}

lexer.S = S;

module.exports = lexer;
