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

var assignObject = Object.assign ||     /* istanbul ignore next: compat */
    function (dst) {
        var i, src, k;
        for (i = 1; i < arguments.length; i++) {
            src = arguments[i];
            if (isObject(src) || isFunction(src)) {
                for (k in src) {
                    if (hasOwnProperty.call(src, k)) {
                        dst[k] = src[k];
                    }
                }
            }
        }
        return dst;
    };

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

// FIXME: weird objects
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
 * loadFunctions(dst, fn, ...fn)
 * loadFunctions(dst, [fn, fn, ... ])
 *
 * Load constructor functions.
 */

function loadFunctions(dst) {
    var i, j, k, arg;

    function loadOne(fn) {
        if (!isFunction(fn)) {
            error('expect function or list/object containing functions as init');
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
 * Combine factory states.
 */

function mergeState(dst, src) {
    if (src) {
        deepMerge(dst.props, src.props);
        assignObject(dst.refs, src.refs);
        assignObject(dst.statics, src.statics);
        assignObject(dst.methods, src.methods);
        loadFunctions(dst.init, src.init);
    }
    return dst;
}

/*
 * Methods under top-level metaFactory function.
 */

function isStamp(o) {
    return isFunction(o) &&
        isFunction(o.refs) && isFunction(o.init) &&
        isFunction(o.statics) && isFunction(o.props) &&
        isFunction(o.methods) && isObject(o.fixed);
}

/*
 * composeFactories(fac, fac, ...)
 *
 * Create new factory by combining arguments.
 */
function composeFactories() {
    var i;
    var opts = {
        refs: {}, props: {}, statics: {}, methods: {}, init: []
    };
    for (i = 0; i < arguments.length; i++) {
        if (!isStamp(arguments[i])) {
            error('compose: Argument must be a factory');
        }
        mergeState(opts, arguments[i].fixed);
    }
    return metaFactory(opts);
}

/*
 * Methods for factory instances.
 */

var factoryMethods = {

    // Return new factory that combines methods from currenct factory with given args
    methods: function methods() {
        var opts = assignObject({}, this.fixed);
        var args = [{}, opts.methods];
        push.apply(args, arguments);
        opts.methods = assignObject.apply(null, args);
        return metaFactory(opts);
    },

    // Return new factory that combines refs from currenct factory with given args
    refs: function refs() {
        var opts = assignObject({}, this.fixed);
        var args = [{}, opts.refs];
        push.apply(args, arguments);
        opts.refs = assignObject.apply(null, args);
        return metaFactory(opts);
    },

    // Return new factory that combines props from currenct factory with given args
    props: function props() {
        var opts = assignObject({}, this.fixed);
        var args = [{}, opts.props];
        push.apply(args, arguments);
        opts.props = deepMerge.apply(null, args);
        return metaFactory(opts);
    },

    // Return new factory that combines props from currenct factory with given args
    statics: function statics() {
        var opts = assignObject({}, this.fixed);
        var args = [{}, opts.statics];
        push.apply(args, arguments);
        opts.statics = assignObject.apply(null, args);
        return metaFactory(opts);
    },

    // Return new factory that combines constructors from currenct factory with given args
    init: function init() {
        var opts = assignObject({}, this.fixed);
        var args = [opts.init.slice()];
        push.apply(args, arguments);
        opts.init = loadFunctions.apply(null, args);
        return metaFactory(opts);
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
 * Static methods for top-level metaFactory function.
 */

function convertConstructor(fn) {
    return metaFactory({
        methods: assignObject({}, fn.prototype),      // FIXME: copy non-own too?
        statics: assignObject({}, fn),
        init: fn
    });
}

function makeShortcut(fn) {
    return function() {
        return fn.apply(metaFactory(), arguments);
    };
}

var utilityFunctions = {
    compose: composeFactories,
    isStamp: isStamp,
    convertConstructor: convertConstructor,

    init: makeShortcut(factoryMethods.init),
    methods: makeShortcut(factoryMethods.methods),
    props: makeShortcut(factoryMethods.props),
    refs: makeShortcut(factoryMethods.refs),
    statics: makeShortcut(factoryMethods.statics)
};

/*
 * Promise-based init helpers.
 */

function promiseInit(factory, promise, initfunc, lastObj, args) {
    return promise.then(function (obj) {
        var argobj = {args: args, instance: obj || lastObj, stamp: factory};
        return initfunc.call(argobj.instance, argobj) || argobj.instance;
    });
}

function returnInstance(argobj) {
    return argobj.instance;
}

/*
 * Main function that creates factories.
 */

function metaFactory(options) {

    // instance factory - fast path
    function factory(instanceRefs) {
        var fixed = factory.fixed;
        var init = fixed.init;
        var numinit = init.length;
        var i, args, nargs;
        var res, argobj;

        // prepare initial object
        var obj = createObject(fixed.methods);
        deepMerge(obj, fixed.props);
        assignObject(obj, fixed.refs, instanceRefs);

        if (numinit > 0) {
            // build args
            nargs = arguments.length ? (arguments.length - 1) : 0;
            args = new Array(nargs);
            for (i = 0; i < nargs; i++) {
                args[i] = arguments[i + 1];
            }

            // run init functions
            argobj = { args: args, instance: obj, stamp: factory };
            for (i = 0; i < numinit; i++) {
                res = init[i].call(obj, argobj);
                if (res) {
                    if (isFunction(res.then)) {
                        // use separate path for promise-based init
                        for (i++; i < numinit; i++) {
                            res = promiseInit(factory, res, init[i], obj, args);
                        }
                        return promiseInit(factory, res, returnInstance, obj, args);
                    }
                    argobj.instance = obj = res;
                }
            }
        }

        return obj;
    }

    // add state to 'factory' function
    var fixed = {methods: factory.prototype, refs: {}, props: {}, statics: {}, init: []};
    mergeState(fixed, options);
    return assignObject(factory, factoryMethods, fixed.statics, {fixed: fixed});
}

// export metaFactory, add utility methods
return assignObject(metaFactory, utilityFunctions);

}));

