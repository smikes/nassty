'use strict';

var through = require('through'),
    re_S = /[ \t\r\n\f]/,
    S = { nassty_token_type: 'S'},
    IDENT = { nassty_token_type: 'IDENT' },
    COMMENT_ML = { nassty_token_type: 'COMMENT_ML' },
    COMMENT_SL = { nassty_token_type: 'COMMENT_SL' };

function LOG() {
    var args = [].slice.call(arguments);
    process.stderr.write(args.join(""));
}

function lexer() {

    var line = 0,
        column = -1,
        tok,
        stream,
        crMaybeLF = false,
        maybeCommentStart = false,
        maybeCommentEnd = false;

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

        LOG("*", tok.type.nassty_token_type, " START\n");
    }

    function useToken() {
        if (tok) {
            stream.queue(tok);
            LOG("*", tok.type.nassty_token_type, " END: ", JSON.stringify(tok.data), "\n");
        }
        tok = undefined;
    }
    function newLine() {
        line += 1;
        column = -1;

        if (tok && tok.type === COMMENT_SL) {
            useToken();
        }
    }

    function readWSShouldReturn(char) {
        if (char === '\f' || char === '\n') {
            crMaybeLF = false;
            makeToken(char, S);
            newLine();
            return true;
        }

        if (crMaybeLF) {
            crMaybeLF = false;
            newLine();
            column = 0;
        }

        if (char === '\r') {
            makeToken(char, S);
            crMaybeLF = true;
            return true;
        }

        if (char.match(re_S)) {
            makeToken(char, S);
            return true;
        }
        return false;
    }

    stream = through(function (chunk) {

        Array.prototype.map.call(String(chunk), function (char) {
            column += 1;

            LOG(" ", 'reading char: ', JSON.stringify(char), '\n');

            if (tok && tok.type === COMMENT_ML) {
                if (maybeCommentEnd && char === '/') {
                    makeToken('*/');
                    return useToken();
                }
                if (maybeCommentEnd) {
                    makeToken('*');
                    maybeCommentEnd = false;
                }
                if (char === '*') {
                    maybeCommentEnd = true;
                } else if (char.match(re_S)) {
                    readWSShouldReturn(char);
                } else {
                    makeToken(char);
                }
                return;
            }

            if (tok && tok.type === COMMENT_SL) {
                if (char.match(re_S)) {
                    readWSShouldReturn(char);
                } else {
                    makeToken(char);
                }
                return;
            }

            if (readWSShouldReturn(char)) {
                return;
            }
            // end of whitespace
            if (tok && tok.type === S) {
                useToken();
            }

            if (maybeCommentStart) {
                maybeCommentStart = false;
                LOG(' maybe comment: "', char, '"\n');
                if (char === '*') {
                    makeToken('/*', COMMENT_ML);
                    return;
                } else if (char === '/') {
                    makeToken('//', COMMENT_SL);
                    return;
                }
                makeToken('/');
            }
            if (char === '/') {
                maybeCommentStart = true;
                return;
            }
            maybeCommentStart = false;

            makeToken(char, IDENT);
            return useToken();
        });
    }, function end() {
        useToken();
        stream.queue(null);
    });

    LOG("**", "Creating lexer\n");

    return stream;
}

lexer.S = S;
lexer.IDENT = IDENT;
lexer.COMMENT_ML = COMMENT_ML;
lexer.COMMENT_SL = COMMENT_SL;

module.exports = lexer;
