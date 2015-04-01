'use strict';

module.exports = function render(options, cb) {
    options = options || {};

    cb(null, {
        css: '',
        map: {}
    });
};
