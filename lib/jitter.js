(function() {
  var BANNER, CoffeeCompiler, CoffeeScript, Jitter, _ref, exec, fs, load, path, print, puts, q, watch;
  var __bind = function(func, context) {
    return function(){ return func.apply(context, arguments); };
  }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    var ctor = function(){};
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
    if (typeof parent.extended === "function") parent.extended(child);
    child.__super__ = parent.prototype;
  };
  /*
    Jitter, a CoffeeScript compilation utility

    The latest version and documentation, can be found at:
    http://github.com/TrevorBurnham/Jitter

    Copyright (c) 2010 Trevor Burnham
    http://iterative.ly

    Based on command.coffee by Jeremy Ashkenas
    http://jashkenas.github.com/coffee-script/documentation/docs/command.html

    Growl notification code contributed by Andrey Tarantsov
    http://www.tarantsov.com/

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
  */
  fs = require('fs');
  path = require('path');
  CoffeeScript = require('coffee-script');
  _ref = require('child_process');
  exec = _ref.exec;
  _ref = require('sys');
  puts = _ref.puts;
  print = _ref.print;
  _ref = require('sink');
  q = _ref.q;
  BANNER = 'Jitter takes a directory of *.coffee files and recursively compiles\nthem to *.js files, preserving the original directory structure.\n\nJitter also watches for changes and automatically recompiles as\nneeded. It even detects new files, unlike the coffee utility.\n\nIf passed a test directory, it will run each test through node on\neach change.\n\nUsage:\n  jitter coffee-path js-path [test-path]';
  Jitter = function() {};
  Jitter.compilers = {};
  Jitter.prototype.watchedFiles = {};
  Jitter.prototype.rootCompile = function() {
    var _ref2;
    _ref2 = [[], [], {}];
    this.changed = _ref2[0];
    this.compiled = _ref2[1];
    this.errors = _ref2[2];
    this.scanDir(this.source);
    return q(__bind(function() {
      return this.changed.length > 0 ? (Object.keys(this.errors).length === 0 ? this.onSuccess() : this.onError()) : null;
    }, this));
  };
  Jitter.prototype.scanDir = function(directory) {
    var _i, _len, _ref2, _result, item, mtime, sourcePath;
    _result = []; _ref2 = fs.readdirSync(directory);
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      item = _ref2[_i];
      sourcePath = ("" + (this.source) + "/" + (item));
      mtime = fs.statSync(sourcePath).mtime.valueOf();
      if (this.watchedFiles[sourcePath] === mtime) {
        continue;
      }
      if (sourcePath.match(this.pattern)) {
        this.watchedFiles[sourcePath] = mtime;
        this.changed.push(sourcePath);
        try {
          if (this.target) {
            this.compile(sourcePath);
          }
          this.onChange(sourcePath);
        } catch (err) {
          this.errors[sourcePath] = err;
        }
      } else if (fs.statSync(sourcePath).isDirectory()) {
        this.scanDir(sourcePath);
      }
    }
    return _result;
  };
  Jitter.prototype.onError = function() {
    var _ref2, _result, err, name;
    _result = []; _ref2 = this.errors;
    for (name in _ref2) {
      if (!__hasProp.call(_ref2, name)) continue;
      err = _ref2[name];
      _result.push(puts("Error in " + (name) + ":\n" + (err.message)));
    }
    return _result;
  };
  Jitter.prototype.onChange = function(file) {
    return puts("Compiled " + (file));
  };
  Jitter.prototype.onSuccess = function() {
    return puts("finished.");
  };
  CoffeeCompiler = function() {
    return Jitter.apply(this, arguments);
  };
  __extends(CoffeeCompiler, Jitter);
  CoffeeCompiler.prototype.pattern = /\.coffee$/;
  CoffeeCompiler.prototype.compile = function(file) {
    var code, js, jsPath;
    code = fs.readFileSync(file).toString();
    js = CoffeeScript.compile(code, {
      file: file
    });
    jsPath = file.replace(new RegExp("^" + (this.source)), this.target).replace(/coffee$/, "js");
    this.compiled.push(file);
    return q(exec, "mkdir -p " + (path.dirname(jsPath)), function() {
      return fs.writeFileSync(jsPath, js);
    });
  };
  Jitter.compilers["coffee"] = CoffeeCompiler;
  exports.watch = (watch = function(opts) {
    var Watcher;
    Watcher = function(args) {
      var _ref2, func, name;
      _ref2 = args;
      for (name in _ref2) {
        if (!__hasProp.call(_ref2, name)) continue;
        func = _ref2[name];
        (this[name] = func);
      }
      setInterval(__bind(function() {
        return this.rootCompile();
      }, this), 500);
      return this;
    };
    __extends(Watcher, Jitter.compilers[opts.compiler || 'coffee']);
    return new Watcher(opts);
  });
  load = function(file) {
    return eval(CoffeeScript.compile(fs.readFileSync(file).toString(), {
      fileName: file
    }));
  };
  exports.run = function() {
    var args;
    args = process.argv.slice(2);
    switch (args.length) {
      case 0:
        return load('build.jitter');
      case 1:
        return load("" + (args[0]) + ".jitter");
      case 2:
        return watch({
          source: args[0],
          target: args[1]
        });
    }
  };
}).call(this);
