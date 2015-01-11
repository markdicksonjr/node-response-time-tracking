module.exports = EventBucket;

var MAX_BUFFER_SIZE = 10240;

// options:
// - collection (optional mongodb collection)
// - processFunction (optional)
// - onFullFunction (optional)
function EventBucket(options) {
    this._semaphore = require('semaphore')(1);
    this._collection = options.collection;
    this._processFunction = options.processFunction;
    this._onFullFunction = options.onFullFunction;
    this._queue = [];

    var that = this;
    setInterval(function() {
        that.process(function() {});
    }, options.intervalMs);
}

EventBucket.prototype.report = function(value) {
    var that = this;
    this._semaphore.take(function() {
        if(that._queue.length < MAX_BUFFER_SIZE) {
            that._queue.push(value);
        } else {

            if(that._onFullFunction) {
                that._onFullFunction(value);
            }
        }
        that._semaphore.leave();
    });
};

EventBucket.prototype.process = function(callback2) {
    var that = this;
    this._semaphore.take(function() {

        // go through each item and upsert into DB
        if(that._queue.length == 0) {
            if(that._processFunction) {
                that._processFunction([]);
            }
            that._semaphore.leave();
            callback2();
            return;
        }

        var items = that._queue;
        that._queue = [];

        if(that._collection) {
            that._collection.insert(items, function(err_insert, insert_result) {
                that._semaphore.leave();
                callback2(err_insert, insert_result);
            });
            return;
        }

        if(that._processFunction) {
            that._processFunction(items);
            that._semaphore.leave();
            callback2();
        }
    });
};