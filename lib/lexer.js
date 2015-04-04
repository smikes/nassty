'use strict';

var through = require('through'),
    assert = require('assert'),
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
        l = lexer,
        tok,
        stream,
        stack = [],
        doubleQuoted = { char: '"',
                         tok: l.STRING_DQ,
                         untermTok: l.UNTERMINATED_DQ
                       },
        singleQuoted = { char: "'",
                         tok: l.STRING_SQ,
                         untermTok: l.UNTERMINATED_SQ
                       };

    function top() {
        return stack[stack.length - 1];
    }

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
            top().crMaybeLF = false;
            makeToken(char, l.S);
            newLine();
            return true;
        }

        if (top().crMaybeLF) {
            top().crMaybeLF = false;
            newLine();
            column = 0;
        }

        if (char === '\r') {
            makeToken(char, l.S);
            top().crMaybeLF = true;
            return true;
        }

        if (char.match(re_S)) {
            makeToken(char, l.S);
            return true;
        }
        return false;
    }

    function handleString(strType, char) {
        assert(tok.type === strType.tok);

        if (top().stringEscape) {
            top().stringEscape = false;
            makeToken('\\');
            makeToken(char);
            return true;
        }

        if (char === "\\") {
            top().stringEscape = true;
            return true;
        }

        if (char === '\r' || char === '\n' || char === '\f') {
            makeToken(char);
            tok.type = strType.untermTok;
            useToken();
            stack.pop();
            return true;
        }

        if (char === strType.char) {
            makeToken(char);
            useToken();
            stack.pop();
        } else {
            makeToken(char);
        }
        return true;
    }

    function readMlCommentChar(char) {
        if (top().maybeCommentEnd && char === '/') {
            top().maybeCommentEnd = false;
            makeToken('*/');
            useToken();
            stack.pop();
            return true;
        }

        if (top().maybeCommentEnd) {
            makeToken('*');
            top().maybeCommentEnd = false;
        }

        if (char === '*') {
            top().maybeCommentEnd = true;
        } else if (char.match(re_S)) {
            readWSShouldReturn(char);
        } else {
            makeToken(char);
        }
        return true;
    }

    function makeMlCommentContext() {
        return {
            readChar: readMlCommentChar
        };
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

    function readStringChar(char) {
        handleString(top().strType, char);
        return;
    }

    function makeStringContext(strType) {
        return {
            readChar: readStringChar,
            strType: strType
        };
    }

    function readChar(char) {
        LOG(" ", 'reading char: ', JSON.stringify(char), '\n');

        if (handleSlComment(char)) {
            return;
        }

        if (char === singleQuoted.char) {
            makeToken(char, singleQuoted.tok);
            stack.push(makeStringContext(singleQuoted));
            return true;
        }
        if (char === doubleQuoted.char) {
            makeToken(char, doubleQuoted.tok);
            stack.push(makeStringContext(doubleQuoted));
            return true;
        }

        if (top().maybeCommentStart) {
            top().maybeCommentStart = false;
            LOG(' maybe comment: "', char, '"\n');
            if (char === '*') {
                makeToken('/*', l.COMMENT_ML);
                stack.push(makeMlCommentContext());
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
        top().maybeCommentStart = false;
        if (char === '/') {
            top().maybeCommentStart = true;
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
    }

    function makeGeneralContext() {
        return { readChar: readChar };
    }
    stack.push(makeGeneralContext());

    stream = through(function (chunk) {

        Array.prototype.map.call(String(chunk), function (char) {
            column += 1;

            top().readChar(char);
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
