/*!
 * based on response-time from:
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

var onHeaders = require('on-headers');

var EventBucket = require('./event-bucket');

var _eventBucket = new EventBucket({
    processFunction: _processTime,
    intervalMs: 15000
});

var response_times = [];
var response_times_limit = 300; // record at least 75 minutes worth of requests

var long_requests = [];
var long_requests_limit = 100;
var long_request_threshold = 5000;

var longest_requests = [];
var longest_requests_limit = 10;
var longest_requests_min_time = null;

module.exports = {
    middleware: responseTime,

    clearResponseTimes: _clearResponseTimes,
    clearLongRequests: _clearLongRequests,
    clearLongestRequests: _clearLongestRequests,

    response_times: response_times,
    longest_requests: longest_requests,
    long_requests: long_requests,
    long_request_threshold: long_request_threshold
};

/**
 * Reponse time:
 *
 * Adds the `X-Response-Time` header displaying the response
 * duration in milliseconds.  Also, keeps counts for recent request times.
 *
 * @param {object} [options]
 * @param {number} [options.digits=3]
 * @param {string} [options.suffix="ms"]
 * @param {boolean} [options.set_header=false]
 * @param {number} [options.intervalMs=15000]
 * @return {function}
 * @api public
 */
function responseTime(options) {
    options = options || {};

    // response time digits
    var digits = options.digits !== undefined
        ? options.digits
        : 3;

    // header name
    var header = options.header || 'X-Response-Time';

    // display suffix
    var suffix = options.suffix !== undefined
        ? Boolean(options.suffix)
        : true;

    var set_header = options.set_header || false;

    if(options.intervalMs !== undefined) {
        _eventBucket = new EventBucket({
            processFunction: _processTime,
            intervalMs: options.intervalMs
        });
    }

    return function responseTime(req, res, next) {
        var startAt = process.hrtime();

        onHeaders(res, function () {
            if (this.getHeader(header)) {
                return
            }

            var diff = process.hrtime(startAt);
            var ms = diff[0] * 1e3 + diff[1] * 1e-6;

            setTimeout(function() {
                _eventBucket.report({
                    at: (new Date()).getTime(),
                    took: ms,
                    path: req.path,
                    user: (req.session && req.session.user ? req.session.user.user : null),
                    method: req.method
                });
            }, 0);

            if(set_header) {
                var val = ms.toFixed(digits);

                if (suffix) {
                    val += 'ms'
                }

                this.setHeader(header, val);
            }
        });

        next();
    }
}

function _processTime(items) {
    var total = 0, n = items.length, average = 0, max = null, paths = {};

    if(n > 0) {
        items.forEach(function(item) {
            max = (max ? Math.max(item.took, max) : item.took);
            total += item.took;
            paths[item.path] = 1;

            if(item.took > long_request_threshold) {
                long_requests.push(_generateLongRequestRecord(item));
            }

            _processLongestRequestPotential(item);
        });

        average = total / items.length;
    }

    response_times.push({
        avg: average,
        max: (max ? max : 0),
        n: n,
        sum: total,
        at: (new Date()).getTime()
        //paths: Object.keys(paths)
    });

    if(response_times.length > response_times_limit) {
        response_times = response_times.slice(1);
    }

    if(long_requests.length > long_requests_limit) {
        long_requests = long_requests.slice(long_requests.length - long_requests_limit);
    }
}

function _generateLongRequestRecord(item) {
    return {
        took: item.took,
        path: item.path,
        method: item.method,
        at: item.at,
        user: item.user
    };
}

function _processLongestRequestPotential(item) {

    // if we haven't hit the limit yet for longest requests
    if(longest_requests.length < longest_requests_limit) {
        longest_requests.push(_generateLongRequestRecord(item));

        // at the time we fill the array, calculate the minimum for the first time
        if(longest_requests.length == longest_requests_limit) {

            // order the list
            longest_requests.sort(function(item1, item2) {
                return item1.took - item2.took;
            });

            // update minimum time
            longest_requests_min_time = longest_requests[0].took;
        }

    } else {

        // if this is above the minimum required to get into the list
        if(longest_requests_min_time < item.took) {

            // add it to the list
            longest_requests.push(_generateLongRequestRecord(item));

            // order the list
            longest_requests.sort(function(item1, item2) {
                return item1.took - item2.took;
            });

            // drop minimum item
            longest_requests.shift();

            // update minimum time
            longest_requests_min_time = longest_requests[0].took;
        }
    }
}

function _clearResponseTimes() {
    response_times.splice(0, response_times.length);
}

function _clearLongRequests() {
    long_requests.splice(0, long_requests.length);
}

function _clearLongestRequests() {
    longest_requests.splice(0, longest_requests.length);
}