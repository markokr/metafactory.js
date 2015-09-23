/*global metaFactory */
/*jshint node:true, qunit:true */

(function (metaFactory) {
'use strict';

// support both QUnit and nodeunit
var test = function (name, func) {
    if (typeof QUnit !== 'undefined') {
        QUnit.test(name, func);
    } else if (module.exports[name]) {
        throw new Error("double name: "+name);
    } else {
        module.exports[name] = function(test) {
            func(test);
            test.done();
        };
    }
};

// JSON dumper with stable key order
var dump = (function () {
    var toString = Object.prototype.toString;
    var isArray = Array.isArray || function (a) { return toString.call(a) === '[object Array]'; };
    var escMap = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
    var escFunc = function (m) { return escMap[m] || '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1); };
    var escRE = /[\\"\u0000-\u001F\u2028\u2029]/g;
    return function stringify(value) {
        if (value == null) {
            return 'null';
        } else if (typeof value === 'number') {
            return isFinite(value) ? value.toString() : 'null';
        } else if (typeof value === 'boolean') {
            return value.toString();
        } else if (typeof value === 'object') {
            if (typeof value.toJSON === 'function') {
                return stringify(value.toJSON());
            } else if (isArray(value)) {
                var res = '[';
                for (var i = 0; i < value.length; i++)
                    res += (i ? ', ' : '') + stringify(value[i]);
                return res + ']';
            } else if (toString.call(value) === '[object Object]') {
                var tmp = [];
                for (var k in value) {
                    if (value.hasOwnProperty(k))
                        tmp.push(stringify(k) + ': ' + stringify(value[k]));
                }
                tmp.sort();
                return '{' + tmp.join(', ') + '}';
            }
        }
        return '"' + value.toString().replace(escRE, escFunc) + '"';
    };
})();

/*
 * Helpers for test data
 */

function extend(dst, src) {
    for (var k in src) {
        if (src.hasOwnProperty(k)) {
            dst[k] = src[k];
        }
    }
    return dst;
}

function lst() {
    var i, tmp = [];
    for (i = 0; i < arguments.length; i++) {
        tmp.push(arguments[i]);
    }
    return dump(tmp);
}

function klist(obj) {
    var k, res = [];
    for (k in obj) {
        if (obj.hasOwnProperty(k)) {
            res.push(k);
        }
    }
    res.sort();
    return res.join(',');
}

function funcWithProto() {
    function ClassA(){}
    ClassA.prototype = {};
    ClassA.prototype.foo = function () { return 'FOO'; };
    ClassA.prototype.data = {a:1};
    ClassA.prototype.astr = 1;

    function ClassB(){ this.own1 = 2; }
    ClassB.prototype = new ClassA();
    ClassB.prototype.poof = function(){return 'POOF';};
    ClassB.prototype.bstr = 1;
    return ClassB;
}

function objWithProto() {
    var ClassB = funcWithProto();
    var o = new ClassB();
    o.own2 = 9;
    return o;
}

function useProto(odata, pdata) {
    function Base() { }
    extend(Base.prototype, pdata);
    var obj = new Base();
    return extend(obj, odata);
}

/*
 * Tests
 */

test("dump", function TestDump(assert) {
    var pt = useProto({'a':1}, {'b':2});
    assert.equal(dump({'b':1, 'a':2}), '{"a": 2, "b": 1}');
    assert.equal(dump({'1':{'a':1}, '2':[1,{},[]]}), '{"1": {"a": 1}, "2": [1, {}, []]}');
    assert.equal(dump('b:\\ dq:" sq:\' n:\n r:\r t:\t'), '"b:\\\\ dq:\\" sq:\' n:\\n r:\\r t:\\t"');
    assert.equal(dump('\u0000 \u001f \u2028 \u2029'), '"\\u0000 \\u001f \\u2028 \\u2029"');
    assert.equal(dump({u:undefined,nil:null, i:999,d:1.11, nan:0/0, t:true, f:false, y:Infinity}),
                 '{"d": 1.11, "f": false, "i": 999, "nan": null, "nil": null, "t": true, "u": null, "y": null}');
    assert.equal(dump(pt), '{"a": 1}');
    assert.equal(dump(new Date(1265429342003)), '"2010-02-06T04:09:02.003Z"');
    assert.equal(dump(new Array(2)), '[null, null]');
});

test("basics", function TestBasics(assert) {

    assert.ok(typeof metaFactory === 'function');

    var f = metaFactory();
    assert.ok(typeof f === 'function');
    assert.ok(metaFactory.isStamp(f));

    f = metaFactory({func: function(){return 'foo';}}, {att: 'a'}, function(){ this.init = 'b'; });
    var o = f();
    assert.equal(o.func(), 'foo');
    assert.equal(o.att, 'a');
    assert.equal(o.init, 'b');
    assert.ok(!o.hasOwnProperty('func'));
    assert.ok(o.hasOwnProperty('att'));
    assert.ok(o.hasOwnProperty('init'));
    assert.ok(o instanceof f);
    assert.ok(o.constructor === f);

    // test errors
    //assert.throws(function(){render('{{ foo[] }}', data);}, Error);
});

test('merge', function testmerge(assert) {
    var merge = metaFactory.merge;

    var a = {a:1, b: [1,2], c: {x: 1, y: 2}};
    var b = {a:2, b: [3,4], c: {x: 4, z: 5}};
    var x = merge({}, a, b);
    var q = merge({b: '', c: ''}, b, a);

    assert.equal(dump(a), '{"a": 1, "b": [1, 2], "c": {"x": 1, "y": 2}}');
    assert.equal(dump(b), '{"a": 2, "b": [3, 4], "c": {"x": 4, "z": 5}}');
    assert.equal(dump(x), '{"a": 2, "b": [1, 2, 3, 4], "c": {"x": 4, "y": 2, "z": 5}}');
    assert.equal(dump(q), '{"a": 1, "b": [3, 4, 1, 2], "c": {"x": 1, "y": 2, "z": 5}}');
});

test('clone', function testclone(assert) {
    var clone = metaFactory.clone;
    var state = {a:[1,{}]};
    assert.equal(dump(clone(state)), '{"a": [1, {}]}');

    var o = objWithProto();
    var o2 = clone(o);
    assert.equal(lst(o2.own1, o2.own2, o2.poof, o2.data, o2.foo), '[2, 9, null, null, null]');
    assert.equal(clone(1), 1);

    assert.throws(function(){clone(/x/);}, TypeError);
});

test('state', function teststate(assert) {
    var f = metaFactory({}, {a:1, b:{c:2}, d:4}, []);
    var f2 = f.state({a:5,b:{e:2}}, {a:6});
    var o = f({d:5});
    var o2 = f2({g:3});

    assert.equal(dump(o), '{"a": 1, "b": {"c": 2}, "d": 5}');
    assert.equal(dump(o2), '{"a": 6, "b": {"c": 2, "e": 2}, "d": 4, "g": 3}');

    var f3 = metaFactory({}, objWithProto(), null);
    var o3 = f3();

    var f4 = metaFactory();
    var o4 = f4(objWithProto());

    assert.deepEqual(klist(o3), 'own1,own2');
    assert.deepEqual(klist(o4), 'own1,own2');
});

test('methods', function teststate(assert) {
    var f = metaFactory({a:function(){return 'A';}, b:function(){return 'B';}});
    var f2 = f.methods({a:function(){return 'AA';}, c:function(){return 'C';}},
                       {a:function(){return 'AAA';}, d:function(){return 'D';}});
    var o = f();
    var o2 = f2();

    assert.equal(o.a() + o.b(), 'AB');
    assert.equal(o2.a() + o2.b() + o2.c() + o2.d(), 'AAABCD');
});

test('enclose-arg', function testenclose(assert) {
    var f = metaFactory({}, {}, function(a,b,c){ this.c = c; });
    var o = f({}, 1,2,3);
    assert.equal(o.c, 3);
    var f2 = metaFactory({}, {}, [function(a,b,c){ this.a = a;}, function(a,b,c){ this.c = c; }]);
    var o2 = f2({}, 1,2,3);
    assert.equal(o2.a, 1);
    assert.equal(o2.c, 3);

    var o3 = metaFactory({a:1}, {b:5}, [function(){this.d = this.a + this.b + this.c;}]).create({c:2});
    assert.equal(o3.d, 8);

    var ff = metaFactory({},{},[function(a,b){this.a = a;}, function(a,b){this.b=b;}]);
    var oo = ff({}, 10, 11);
    assert.equal(lst(oo.a, oo.b), '[10, 11]');

    var ff2 = metaFactory({},{},{aa: function(a,b){this.a = a;}, bb:function(a,b){this.b=b;} });
    var oo2 = ff2({}, 20, 21);
    assert.equal(lst(oo2.a, oo2.b), '[20, 21]');

    var e3 = useProto({a: function(){ this.a = 1;}}, {b: function(){ this.b = 2;}});
    var ff3 = metaFactory({},{},e3);
    var oo3 = ff3({});
    assert.equal(lst(oo3.a, oo3.b), '[1, null]');
});

test("enclose-errors", function (assert) {
    assert.throws(function(){ metaFactory({},{},['a']); }, TypeError);
    assert.throws(function(){ metaFactory({},{},'a'); }, TypeError);
    assert.throws(function(){ metaFactory().enclose(function(){ this.x = 'X'; }, 2); }, TypeError);
});

test('enclose', function teststate(assert) {
    var f = metaFactory(null, null, [function (){this.a = 1;}]);
    var f2 = f.enclose(function(){this.b = 2;}, function(){this.c = 3;}).enclose([function(){this.b += 2;}]);

    var o = f();
    var o2 = f2();

    assert.equal(o.a, 1);
    assert.equal(lst(o2.a, o2.b, o2.c), '[1, 4, 3]');
});

test('compose', function teststate(assert) {
    var f1 = metaFactory({a: function() { return 'A'; }}, {b:0});
    var f2 = metaFactory({}, {b: 2}, [function(){this.bb=3;}]);
    var f3 = metaFactory({}, {}, function() { this.c=4; });

    var fc = f1.compose(f2, f3);

    var o = fc();

    assert.equal(o.a(), 'A');
    assert.equal(lst(o.b, o.bb, o.c), '[2, 3, 4]');
});

test('convertConstructor', function teststate(assert) {
    function ClassA(){}
    ClassA.prototype.foo = function(){return 'FOO';};
    ClassA.prototype.data = {a:1};

    function ClassB(){ this.b = 2; }
    ClassB.prototype = new ClassA();
    ClassB.prototype.poof = function(){return 'POOF';};
    assert.ok(new ClassB() instanceof ClassA);

    var f = metaFactory.convertConstructor(ClassB);
    var o = f.create({x:3});

    assert.equal(o.foo(), 'FOO');
    assert.equal(o.poof(), 'POOF');
    assert.equal(o.constructor, f);
    assert.ok(o instanceof f);
    assert.equal(lst(o.x, o.b, o.data), '[3, 2, {"a": 1}]');
});

test('errors', function teststate(assert) {
    assert.throws(function(){metaFactory.merge(1);}, TypeError);
    assert.throws(function(){metaFactory.merge({}, 1);}, TypeError);
    assert.throws(function(){metaFactory.merge({}, {}, 1);}, TypeError);

    assert.throws(function(){metaFactory(1);}, TypeError);
    assert.throws(function(){metaFactory({}, 1);}, TypeError);
    assert.throws(function(){metaFactory({}, {}, 1);}, TypeError);
    assert.throws(function(){metaFactory.compose({});}, TypeError);
    assert.throws(function(){metaFactory().create('');}, TypeError);
});

})(typeof metaFactory !== 'undefined' ? metaFactory : require('./metafactory'));

