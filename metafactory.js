/*
 * metaFactory - Composable object factories.
 *
 * Based on stampit.js by Eric Elliott.
 */

(function (factory) {                   /* istanbul ignore next: UMD wrapper */
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        this.metaFactory = factory();
    }
}(function () {
"use strict";

/*
 * Utilities.
 */

var hasOwnProperty = {}.hasOwnProperty;
var toString = {}.toString;
var push = [].push;

var createObject = Object.create ||     /* istanbul ignore next: compat */
    (function () {
        function Type() {}
        return function (proto) {
            Type.prototype = proto;
            var obj = new Type();
            Type.prototype = null;
            return obj;
        };
    })();

var isArray = Array.isArray ||          /* istanbul ignore next: compat */
    function (a) { return toString.call(a) === "[object Array]"; };

function isFunction(o) {
    return typeof o === "function";
}

function isObject(o) {
    return typeof o === "object" && o !== null;
}

function isPlainObject(o) {
    return isObject(o) && (o.constructor === Object || toString.call(o) === "[object Object]");
}

function error(msg) {
    throw new TypeError(msg);
}

/*
 * Deep clone single value
 */

function deepClone(arg) {
    var res, k, v, i;

    if (!isObject(arg)) {
        return arg;
    }

    if (isArray(arg)) {
        res = new Array(arg.length);
        for (i = 0; i < arg.length; i++) {
            v = arg[i];
            res[i] = isObject(v) ? deepClone(v) : v;
        }
    } else if (isPlainObject(arg)) {
        res = {};
        for (k in arg) {
            if (hasOwnProperty.call(arg, k)) {
                v = arg[k];
                res[k] = isObject(v) ? deepClone(v) : v;
            //} else {
            //    error("Uncloneable value with prototype");
            }
        }
    } else {
        error("Uncloneable value: " + toString.call(arg));
    }
    return res;
}

/*
 * Deep clone + merge objects
 */

function deepMerge(dst) {
    var i, k, v, src;

    if (!isObject(dst)) {
        error('deepMerge: Target must be an object');
    }

    for (i = 1; i < arguments.length; i++) {
        src = arguments[i];
        if (src == null) {
            continue;
        }
        if (!isObject(src)) {
            error('deepMerge: Argument must be an object');
        }

        for (k in src) {
            if (hasOwnProperty.call(src, k)) {
                v = src[k];
                if (isObject(v)) {
                    if (hasOwnProperty.call(dst, k)) {
                        if (isPlainObject(v) && isPlainObject(dst[k])) {
                            deepMerge(dst[k], v);
                            continue;
                        } else if (isArray(v) && isArray(dst[k])) {
                            dst[k] = dst[k].concat(v);
                            continue;
                        }
                    }
                    v = deepClone(v);
                }
                dst[k] = v;
            }
        }
    }
    return dst;
}

/*
 * extendOwn(dst, obj, [obj...])
 *
 * Copy own properties from source objects to target.
 */
function extendOwn(dst) {
    var i, src, k;
    for (i = 1; i < arguments.length; i++) {
        src = arguments[i];
        for (k in src) {
            if (hasOwnProperty.call(src, k)) {
                dst[k] = src[k];
            }
        }
    }
    return dst;
}

/*
 * Clone both own and prototype properties to target.
 */

function extendDeepChain(dst, src) {
    /* jshint forin:false */
    var k, v;
    for (k in src) {
        v = src[k];
        dst[k] = isObject(v) ? deepClone(v) : v;
    }
    return dst;
}

/*
 * loadFunctions(dst, fn, ...fn)
 * loadFunctions(dst, [fn, fn, ... ])
 *
 * Load constructor functions.
 */

function loadFunctions(dst) {
    var i, j, k, arg;

    function loadOne(fn) {
        if (!isFunction(fn)) {
            error('enclose argument must be an function or list/object containing functions');
        }
        dst.push(fn);
    }

    for (i = 1; i < arguments.length; i++) {
        arg = arguments[i];
        if (isArray(arg)) {
            for (j = 0; j < arg.length; j++) {
                loadOne(arg[j]);
            }
        } else if (isPlainObject(arg)) {
            for (k in arg) {
                if (hasOwnProperty.call(arg, k)) {
                    loadOne(arg[k]);
                }
            }
        } else if (arg != null) {
            loadOne(arg);
        }
    }

    return dst;
}

/*
 * Methods under top-level metaFactory function.
 */

function isStamp(o) {
    return isFunction(o) &&
        isFunction(o.state) && isFunction(o.enclose) &&
        isFunction(o.methods) && isObject(o.fixed);
}

/*
 * composeFactories(fac, fac, ...)
 *
 * Create new factory by combining arguments.
 */
function composeFactories() {
    var state = {};
    var methods = {};
    var enclose = [];
    var i, fixed;

    for (i = 0; i < arguments.length; i++) {
        if (!isStamp(arguments[i])) {
            error('compose: Argument must be a factory');
        }
        fixed = arguments[i].fixed;
        deepMerge(state, fixed.state);
        deepMerge(methods, fixed.methods);
        loadFunctions(enclose, fixed.enclose);
    }
    return metaFactory(methods, state, enclose);
}

function convertConstructor(fn) {
    var flatProto = extendDeepChain({}, fn.prototype);
    return metaFactory(flatProto, {}, fn);
}

/*
 * Methods for factory instances.
 */

var factoryMethods = {

    // Return new factory that combines methods from currenct factory with given args
    methods: function methods() {
        var fixed = this.fixed;
        var args = [{}, fixed.methods];
        push.apply(args, arguments);
        return metaFactory(deepMerge.apply(null, args), fixed.state, fixed.enclose);
    },

    // Return new factory that combines state from currenct factory with given args
    state: function state() {
        var fixed = this.fixed;
        var args = [{}, fixed.state];
        push.apply(args, arguments);
        return metaFactory(fixed.methods, deepMerge.apply(null, args), fixed.enclose);
    },

    // Return new factory that combines constructors from currenct factory with given args
    enclose: function enclose() {
        var fixed = this.fixed;
        var args = [fixed.enclose.slice()];
        push.apply(args, arguments);
        return metaFactory(fixed.methods, fixed.state, loadFunctions.apply(null, args));
    },

    // Return new factory that combines from currenct factory with given args
    compose: function compose() {
        var args = [this];
        push.apply(args, arguments);
        return composeFactories.apply(null, args);
    },

    // return new object created by factory
    create: function create() {
        return this.apply(null, arguments);
    }
};

/*
 * Main function that creates factories.
 */

function metaFactory(methods, state, enclose) {

    function factory(newState) {
        var fixed = factory.fixed;
        var enclist = fixed.enclose;
        var encnum = enclist.length;
        var i, args, nargs;

        // prepare initial object
        var obj = createObject(fixed.methods);
        extendDeepChain(obj, fixed.state);

        // insert extra state
        if (newState != null) {
            if (isObject(newState)) {
                extendOwn(obj, newState);
            } else {
                error('factory: new state must be object');
            }
        }

        // run enclosure functions
        if (encnum > 0) {
            nargs = arguments.length ? (arguments.length - 1) : 0;
            args = new Array(nargs);
            for (i = 0; i < nargs; i++) {
                args[i] = arguments[i + 1];
            }

            for (i = 0; i < encnum; i++) {
                obj = enclist[i].apply(obj, args) || obj;
            }
        }

        return obj;
    }

    factory.fixed = {
        methods: deepMerge(factory.prototype, methods),
        state: deepMerge({}, state),
        enclose: loadFunctions([], enclose)
    };

    return extendOwn(factory, factoryMethods);
}

// export metaFactory, add utility methods
return extendOwn(metaFactory, {
    compose: composeFactories,
    isStamp: isStamp,
    convertConstructor: convertConstructor,

    mixIn: extendOwn,
    extend: extendOwn,

    clone: deepClone,
    merge: deepMerge
});

}));

