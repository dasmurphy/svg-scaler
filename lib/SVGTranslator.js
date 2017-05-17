module.exports = SVGTranslator;

var SvgPath = require('svgpath');
var sax = require("sax");
var Q = require('q');


function SVGTranslator(options) {

    if (typeof options !== 'object') {
        throw new Error('options need an object');
    }

    this.options = options;
    this.scale = options.scale || 1;
    this.baseSize = null;
    this.dx = 0;
    this.dy = 0;
}


SVGTranslator.prototype.svgModify = function (svgSrcString) {

    var self = this;
    var parser = sax.parser(true); // set to false for html-mode
    var deferred = Q.defer();

    var svgDestString = '';

    parser.onerror = function (e) {
        console.log(e);
    };

    parser.onopentag = function (node) {
        self.translate(node);
        svgDestString += self._echoOpenTag(node);
    };

    parser.onclosetag = function (nodeName) {
        svgDestString += self._echoCloseTag(nodeName);
    };

    parser.onend = function () {
        // need this for windows issue
        deferred.resolve('<?xml version="1.0"?>' + svgDestString);
    };

    // start process
    parser.write(svgSrcString).close();

    return deferred.promise;
};

SVGTranslator.prototype._echoOpenTag = function (node) {

    var stringArr = [];

    stringArr.push('<');
    stringArr.push(node.name);

    Object.keys(node.attributes).forEach(function (key) {
        stringArr.push(' ');
        stringArr.push(key);
        stringArr.push('=\"');
        stringArr.push(String(node.attributes[key]).replace('"', '&quot;'));
        stringArr.push('\"');
    });

    stringArr.push('>');

    return stringArr.join('');
};

SVGTranslator.prototype._echoCloseTag = function (nodeName) {
    return ['</', nodeName, '>'].join('');
};

SVGTranslator.prototype.parser = function (svgSrcString) {
    var self = this;
    var deferred = Q.defer();

    self.svgModify(svgSrcString)
        .then(function (result) {
            deferred.resolve(result);
        });
    return deferred.promise;
};

SVGTranslator.prototype.translate = function (node) {

    if (node.attributes.stroke) {
        // scale stroke width
        if (!node.attributes['stroke-width']) {
            node.attributes['stroke-width'] = 1;
        }
        node.attributes['stroke-width'] = Math.round(node.attributes['stroke-width']*this.scale*100)/100;
    }

    switch (node.name) {
        case 'svg':
            this.svgCenterScale(node);
            break;
        case 'path':

            node.attributes.d = new SvgPath(node.attributes.d)
                .translate(this.dx, this.dy)
                .scale(this.scale)
                .abs()
                .round(2) // Here the real rounding happens
                .rel()
                .round(2) // Fix js floating point error/garbage after rel()
                .toString();

            break;
        case 'rect':
        case 'line':
        case 'circle':
        case 'ellipse':
        case 'linearGradient':
        case 'radialGradient':
            this.nodeBaseShapeScale(node);

            break;
        case 'polyline':
        case 'polygon':

            this.nodePointsShapeScale(node);

            break;

    }
};

SVGTranslator.prototype.svgCenterScale = function (node) {

    // if (!node.attributes.height && node.attributes.viewBox) {
    //     node.attributes.height = node.attributes.viewBox.split(' ')[3];
    // }
    // if (!node.attributes.width && node.attributes.viewBox) {
    //     node.attributes.width = node.attributes.viewBox.split(' ')[2];
    // }
    var
        width,
        height;

    if (!node.attributes.width||!node.attributes.height) {
        // use the viewbox instead of direct size
        var viewbox = node.attributes.viewBox.split(' ');
        width = +viewbox[2];
        height = +viewbox[3];
    } else {
        width = parseFloat(node.attributes.width);
        height = parseFloat(node.attributes.height);
    }

    this.dx = 0;
    this.dy = 0;

    if (this.options.width) {
        this.baseSize = this.options.width;

        if (width >= height) {
            this.scale = this.options.width / width;
            this.dy = (width - height) / 2;


        } else {
            this.scale = this.options.width / height;
            this.dx = (height - width) / 2;
        }

        width = this.baseSize;
        height = this.baseSize;

    } else {
        width = width * this.scale;
        height = height * this.scale;
    }

    // remove width/height and use only viewbox
    if (node.attributes.width) delete node.attributes.width;
    if (node.attributes.height) delete node.attributes.height;

    node.attributes.viewBox = [0, 0, width, height].join(' ');
};

SVGTranslator.prototype.nodeBaseShapeScale = function (node) {

    var self = this;

    var dxAttrs = ['cx', 'x', 'x1', 'x2'];
    var dyAttrs = ['cy', 'y', 'y1', 'y2'];

    var scaleAttrs = ['width', 'height', 'rx', 'ry', 'r'].concat(dxAttrs).concat(dyAttrs);

    if (!node.attributes) {
        throw new Error('not attributes');
    }

    var applied;
    Object.keys(node.attributes).forEach(function (attrKey) {
        applied = false;
        if (scaleAttrs.indexOf(attrKey) > -1) {
            node.attributes[attrKey] *= self.scale;
            applied = true;
        }
        if (dxAttrs.indexOf(attrKey) > -1) {
            node.attributes[attrKey] += self.dx;
            applied = true;
        }
        if (dyAttrs.indexOf(attrKey) > -1) {
            node.attributes[attrKey] += self.dy;
            applied = true;
        }
        if (applied) node.attributes[attrKey] = Math.round(node.attributes[attrKey]*100)/100;
    })


};

SVGTranslator.prototype.nodePointsShapeScale = function (node) {

    var self = this;
    var pair = null;

    if (!node.attributes.points) {
        throw new Error('not points');
    }

    node.attributes.points = node.attributes.points
        .replace(/(^\s*)|(\s*$)/g, "") // trim
        .split(/\s+/).map(function (point) {
            pair = point.split(',');
            pair[0] = pair[0] * self.scale + self.dx;
            pair[1] = pair[1] * self.scale + self.dy;
            return pair.join(',');
        }).join(' ');

};




