'use strict';

var through = require('through'),
    re_S = /[ \t\r\n\f]/,
    S = {};

function lexer() {

    var stream = through(function (chunk) {

        Array.prototype.map.call(String(chunk), function (char) {
            if (char.match(re_S)) {
                return stream.emit({data: char, type: S});
            }
            stream.emit({data: char});
        });
    });

    return stream;
}

lexer.S = S;

module.exports = lexer;
