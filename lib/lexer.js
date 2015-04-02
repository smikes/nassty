'use strict';

var through = require('through'),
    re_S = /[ \t\r\n\f]/,
    lexer,
    tokens = [ 'S',
               'IDENT',
               'COMMENT_ML',
               'COMMENT_SL',
               'SLASH',
               'STRING_SQ',
               'UNTERMINATED_SQ',
               'STRING_DQ',
               'UNTERMINATED_DQ'
             ];

function llexer(options) {

    var line = 0,
        column = -1,
        tok,
        stream,
        crMaybeLF = false,
        maybeCommentStart = false,
        maybeCommentEnd = false,
        stringEscape = false,
        l = lexer,
        doubleQuoted = { char: '"',
                         tok: l.STRING_DQ,
                         untermTok: l.UNTERMINATED_DQ
                       },
        singleQuoted = { char: "'",
                         tok: l.STRING_SQ,
                         untermTok: l.UNTERMINATED_SQ
                       };

    function LOG() {
        if (options && options.logger) {
            options.logger.apply(undefined, arguments);
        }
    }

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

        // some tokens are terminated by newline
        if (tok.type === l.COMMENT_SL) {
            useToken();
        }
    }

    function readWSShouldReturn(char) {
        if (char === '\f' || char === '\n') {
            crMaybeLF = false;
            makeToken(char, l.S);
            newLine();
            return true;
        }

        if (crMaybeLF) {
            crMaybeLF = false;
            newLine();
            column = 0;
        }

        if (char === '\r') {
            makeToken(char, l.S);
            crMaybeLF = true;
            return true;
        }

        if (char.match(re_S)) {
            makeToken(char, l.S);
            return true;
        }
        return false;
    }

    function handleString(strType, char) {
        if (tok && tok.type === strType.tok) {
            if (stringEscape) {
                stringEscape = false;
                makeToken('\\');
                makeToken(char);
                return true;
            }

            if (char === "\\") {
                stringEscape = true;
                return true;
            }

            if (char === '\r' || char === '\n' || char === '\f') {
                makeToken(char);
                tok.type = strType.untermTok;
                useToken();
                return true;
            }

            if (char === strType.char) {
                makeToken(char);
                useToken();
            } else {
                makeToken(char);
            }
            return true;
        }

        if (char === strType.char) {
            makeToken(char, strType.tok);
            return true;
        }
    }

    function handleMlComment(char) {
        if (!tok || tok.type !== l.COMMENT_ML) {
            return false;
        }

        if (maybeCommentEnd && char === '/') {
            maybeCommentEnd = false;
            makeToken('*/');
            useToken();
            return true;
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
        return true;
    }

    function handleSlComment(char) {
        if (tok && tok.type === l.COMMENT_SL) {
            if (char.match(re_S)) {
                readWSShouldReturn(char);
            } else {
                makeToken(char);
            }
            return true;
        }
    }

    stream = through(function (chunk) {

        Array.prototype.map.call(String(chunk), function (char) {
            column += 1;

            LOG(" ", 'reading char: ', JSON.stringify(char), '\n');

            if (handleMlComment(char)) {
                return;
            }
            if (handleSlComment(char)) {
                return;
            }
            if (handleString(singleQuoted, char)) {
                return;
            }
            if (handleString(doubleQuoted, char)) {
                return;
            }

            if (maybeCommentStart) {
                maybeCommentStart = false;
                LOG(' maybe comment: "', char, '"\n');
                if (char === '*') {
                    makeToken('/*', l.COMMENT_ML);
                    return;
                }
                if (char === '/') {
                    makeToken('//', l.COMMENT_SL);
                    return;
                }
                useToken();
                makeToken('/', l.SLASH);
                useToken();
            }
            maybeCommentStart = false;
            if (char === '/') {
                maybeCommentStart = true;
                return;
            }

            if (readWSShouldReturn(char)) {
                return;
            }

            if (tok && tok.type === l.S) {
                useToken();
            }

            makeToken(char, l.IDENT);
            return useToken();
        });
    }, function end() {
        useToken();
        stream.queue(null);
    });

    LOG("**", "Creating lexer\n");

    return stream;
}

function lexer(options) {
    return llexer(options);
}

tokens.forEach(function (t) {
    lexer[t] = { nassty_token_type: t };
});

module.exports = lexer;
