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
        states = [],
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

        // some tokens & states are terminated by newline
        if (tok.type === l.COMMENT_SL) {
            useToken();
            stack.pop();
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

        // next character escaped
        if (char === "\\") {
            top().stringEscape = true;
            return true;
        }

        // unescaped newline in unterminated string
        if (char === '\r' || char === '\n' || char === '\f') {
            makeToken(char);
            tok.type = strType.untermTok;
            useToken();
            stack.pop();
            return true;
        }

        // matching end-of-string character
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

    function readSlCommentChar(char) {
        if (char.match(re_S)) {
            readWSShouldReturn(char);
        } else {
            makeToken(char);
        }
    }

    function makeSlCommentContext() {
        return {
            readChar: readSlCommentChar
        };
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

    function readMaybeCommentChar(char) {
        // remove maybe-comment state
        stack.pop();

        LOG(' maybe comment: "', char, '"\n');

        if (char === '*') {
            makeToken('/*', l.COMMENT_ML);
            stack.push(makeMlCommentContext());
            return;
        }

        if (char === '/') {
            makeToken('//', l.COMMENT_SL);
            stack.push(makeSlCommentContext());
            return;
        }

        /* not a comment */
        useToken();
        makeToken('/', l.SLASH);
        useToken();
    }

    function makeMaybeComment() {
        return {
            readChar: readMaybeCommentChar
        };
    }

    states = [
        {
            char: singleQuoted.char,
            tok: singleQuoted.tok,
            newState: function () {
                return makeStringContext(singleQuoted);
            }
        },
        {
            char: doubleQuoted.char,
            tok: doubleQuoted.tok,
            newState: function () {
                return makeStringContext(doubleQuoted);
            }
        },
        {
            char: '/',
            newState: function () {
                return makeMaybeComment();
            }
        }
    ];

    function findState(char) {
        var newStates = states.filter(function (s) { return s.char === char; });
        assert(newStates.length < 2, "at most one state should match");

        return newStates[0];
    }

    function readChar(char) {
        LOG(" ", 'reading char: ', JSON.stringify(char), '\n');

        var s = findState(char);

        if (s) {
            if (s.tok) {
                makeToken(char, s.tok);
            }
            stack.push(s.newState());
            return true;
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
