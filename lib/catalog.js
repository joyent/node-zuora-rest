'use strict';

function Catalog(opts) {
    if(!(this instanceof Catalog)) {
        return new Catalog(opts);
    }
    this.client = opts.client;
    this.ttl = opts.ttl || 3600 * 1000;
    this._buffered = false;
    this._buffering = false;
    this._buffer = [];
    this._bufferWait = [];
}

Catalog.prototype.get = function (opts, callback) {
    var self = this;
    if(!callback) {
        callback = opts;
        opts = false;
    }

    self.client.get('/rest/v1/catalog/products', opts, callback);
};

Catalog.prototype.query = function (params, callback) {
    var self = this;

    function search(err) {
        if(err) {
            callback(err);
            return;
        }
        var arr = Object.keys(params);
        var resp = self._buffer.filter(function (el) {
            var i;
            for(i in arr) {
                if(el[i] !== params[i]) {
                    return false;
                }
            }
            return true;
        });
        callback(null, resp);
    }

    if(self._buffered && !self._buffering) {
        search();
        return;
    }

    self._bufferWait.push(search);
    if(!self._buffering) {
        self.__buffer();
    }

};

Catalog.prototype.__buffer = function () {
    var self = this;
    self._buffering = true;
    self._buffered = false;
    self._buffer = [];

    function respond(err) {
        self._buffered = true;
        self._buffering = false;

        self._bufferWait.forEach(function(fn) {
            fn(err);
        });
        if(!err) {
            setTimeout(function () {
                self._buffered = false;
            }, self.ttl);
        }
    }

    function handleResp(err, resp) {
        if(err) {
            respond(err);
            return;
        }
        resp.products.forEach(function (p) {
            self._buffer.push(p);
        });
        if(resp.nextPage) {
            nextPage(resp.nextPage);
            return;
        }
        respond();
    }

    self.get({pageSize:40}, handleResp);

    function nextPage(url) {
        self.client.get(url, false, handleResp);
    }
};

module.exports = Catalog;