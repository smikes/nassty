'use strict';

var nassty = require('..');
var nodeSass = require('node-sass');

var Code = require('code');
var Lab = require('lab');
var lab = Lab.script();
exports.lab = lab;

var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('nassty', function () {
    describe('render', function () {
        it('is a function', function (done) {
            expect(nassty.render).to.be.instanceof(Function);
            done();
        });

        it('returns some data', function (done) {
            nassty.render({ data: '' }, function (err, result) {
                expect(err).to.equal(null);
                expect(result.css).to.equal('');
                expect(result.map).to.deep.equal({});
                done();
            });
        });
    });
});

