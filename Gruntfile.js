
module.exports = function(grunt) {
    "use strict";

    grunt.initConfig({
        "pkg": grunt.file.readJSON("package.json"),
        "uglify": {
            "options": { "preserveComments": "some" },
            "metafactory": { "files": { "dist/metafactory.min.js": "metafactory.js" } }
        },
        "jshint": {
            "all": { "src": ["*.js"] },
            "options": {
                //"reporter": "checkstyle",
                "jshintrc": true
            }
        },
        "clean": {
            "files": ["build"]
        },
        "node-qunit": {
            "test": {
                "code": { "path": "metafactory.js", "namespace": "metaFactory" },
                "tests": "test.js"
            }
        },
        "nodeunit": {
            "test": ["test.js"],
            "coverage": ["instrument/test.js"]
        },
        "copy": {
            "test": {
                "src": ["test.js"],
                "dest": "instrument/"
            }
        },
        "instrument": {
            "files": ["metafactory.js"],
            "options": { "basePath": "instrument/" }
        },
        "storeCoverage": {
            "options": { "dir": "instrument/" }
        },
        "makeReport": {
            "src": "instrument/*.json",
            "options": {
                "type": "lcov",
                "print": "summary",
                "dir": "instrument"
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-nodeunit");
    grunt.loadNpmTasks("grunt-node-qunit");
    grunt.loadNpmTasks("grunt-istanbul");

    grunt.registerTask("default", ["jshint", "uglify", "node-qunit", "cov"]);
    grunt.registerTask('cov', ['clean', 'copy', 'instrument', 'nodeunit:coverage', 'storeCoverage', 'makeReport']);
    grunt.registerTask('test', [ 'node-qunit', 'nodeunit:test' ]);
};

