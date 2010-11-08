(function() {
  var BANNER, CoffeeCompiler, CoffeeScript, Jitter, _ref, exec, fs, load, path, print, puts, q, showHelp, watch;
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
  fs = require("fs");
  path = require("path");
  CoffeeScript = require("coffee-script");
  _ref = require("child_process");
  exec = _ref.exec;
  _ref = require("sys");
  puts = _ref.puts;
  print = _ref.print;
  _ref = require("sink");
  q = _ref.q;
  BANNER = "Jitter takes a directory of *.coffee files and recursively compiles\nthem to *.js files, preserving the original directory structure.\n\nJitter also watches for changes and automatically recompiles as\nneeded. It even detects new files, unlike the coffee utility.\n\nIf passed a test directory, it will run each test through node on\neach change.\n\nUsage:\n  jitter coffee-path js-path [test-path]";
  Jitter = function() {};
  Jitter.compilers = {};
  Jitter.watching = [];
  Jitter.prototype.watchedFiles = {};
  Jitter.prototype.rootCompile = function() {
    var _ref2;
    _ref2 = [[], [], {}];
    this.changed = _ref2[0];
    this.compiled = _ref2[1];
    this.errors = _ref2[2];
    this.scanDir(this.source);
    return q(__bind(function() {
      return this.changed.length > 0 ? (Object.keys(this.errors).length === 0 ? (typeof this.onSuccess === "function" ? this.onSuccess() : undefined) : (typeof this.onError === "function" ? this.onError() : undefined)) : null;
    }, this));
  };
  Jitter.prototype.scanDir = function(directory) {
    var _i, _len, _ref2, _result, mtime, sourcePath, targetPath;
    _result = []; _ref2 = fs.readdirSync(directory);
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      var item = _ref2[_i];
      sourcePath = ("" + (directory) + "/" + (item));
      mtime = fs.statSync(sourcePath).mtime.valueOf();
      if (this.watchedFiles[sourcePath] === mtime) {
        continue;
      }
      if (fs.statSync(sourcePath).isDirectory()) {
        this.scanDir(sourcePath);
      } else if (sourcePath.match(this.match)) {
        this.watchedFiles[sourcePath] = mtime;
        this.changed.push(sourcePath);
        (typeof this.onChange === "function" ? this.onChange(sourcePath) : undefined);
        if (this.target) {
          targetPath = sourcePath.replace(new RegExp("^" + (this.source)), this.target).replace(this.match, this.targetExtension);
          q(exec, "mkdir -p " + (path.dirname(targetPath)), __bind(function() {
            try {
              this.compile(sourcePath, targetPath);
              this.compiled.push(sourcePath);
              return (typeof this.onCompile === "function" ? this.onCompile(sourcePath, targetPath) : undefined);
            } catch (err) {
              return (this.errors[file] = err);
            }
          }, this));
        }
      }
    }
    return _result;
  };
  Jitter.prototype.onError = function() {
    var _ref2, _ref3, _result, err, name;
    _result = []; _ref2 = this.errors;
    for (name in _ref2) {
      if (!__hasProp.call(_ref2, name)) continue;
      err = _ref2[name];
      _result.push((function() {
        _ref3 = this.errors;
        for (name in _ref3) {
          if (!__hasProp.call(_ref3, name)) continue;
          err = _ref3[name];
          puts("Error in " + (name) + ":\n" + (err.message));
        }
        return this.notifyError(name, err.message);
      }).call(this));
    }
    return _result;
  };
  Jitter.prototype.onCompile = function(sourceFile, targetFile) {
    return puts("Compiled " + (sourceFile));
  };
  Jitter.compilers["coffee"] = (function() {
    CoffeeCompiler = function() {
      return Jitter.apply(this, arguments);
    };
    __extends(CoffeeCompiler, Jitter);
    CoffeeCompiler.prototype.match = /\.coffee$/;
    CoffeeCompiler.prototype.targetExtension = ".js";
    CoffeeCompiler.prototype.compile = function(sourcePath, targetPath) {
      var code, js;
      code = fs.readFileSync(sourcePath).toString();
      js = CoffeeScript.compile(code, {
        sourcePath: sourcePath
      });
      return fs.writeFileSync(targetPath, js);
    };
    return CoffeeCompiler;
  })();
  Jitter.prototype.notifyError = function(source, errMessage) {
    var basename, m, message;
    basename = source.replace(/^.*[\/\\]/, '');
    if (m = errMessage.match(/Parse error on line (\d+)/)) {
      message = ("Parse error in " + (basename) + "\non line " + (m[1]) + ".");
    } else {
      message = ("Error in " + (basename) + ".");
    }
    return this.notify("Compilation failed", message);
  };
  Jitter.prototype.notify = function(title, message) {
    return exec("growlnotify -n Jitter -p 2 -t \"" + (title) + "\" -m \"" + (message) + "\"");
  };
  Jitter.prototype.runAll = function(command, directory, pattern, callback) {
    var _i, _len, _ref2, _result;
    _result = []; _ref2 = fs.readdirSync(directory);
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      (function() {
        var sourcePath;
        var item = _ref2[_i];
        return _result.push((function() {
          sourcePath = ("" + (directory) + "/" + (item));
          if (fs.statSync(sourcePath).isDirectory()) {
            return this.runAll(command, sourcePath, pattern);
          } else if (item.match(pattern)) {
            return q(exec, "" + (command) + " " + (sourcePath), function(error, stdout, stderr) {
              return callback(sourcePath, stdout, stderr);
            });
          }
        }).call(this));
      }).call(this);
    }
    return _result;
  };
  Jitter.prototype.runTests = function(command, directory, pattern) {
    return this.runAll(command, directory, pattern, __bind(function(test, stdout, stderr) {
      print(stdout);
      print(stderr);
      if (stderr) {
        return this.notify("Test failed: " + (test), stderr);
      }
    }, this));
  };
  CoffeeCompiler.prototype.runTests = function(directory) {
    directory || (directory = "test");
    return CoffeeCompiler.__super__.runTests.call(this, "coffee", directory, /^test.*\.coffee$/);
  };
  watch = function(opts) {
    var Watcher;
    Watcher = function() {
      var _ref2, func, name;
      _ref2 = opts;
      for (name in _ref2) {
        if (!__hasProp.call(_ref2, name)) continue;
        func = _ref2[name];
        (this[name] = func);
      }
      return this;
    };
    __extends(Watcher, Jitter.compilers[opts.compiler || "coffee"]);
    return Jitter.watching.push(new Watcher());
  };
  load = function(file) {
    if (!(file.match(/\.jitter$/))) {
      file = ("" + (file) + ".jitter");
    }
    try {
      return eval(CoffeeScript.compile(fs.readFileSync(file).toString()));
    } catch (err) {
      puts(err.message + "\n");
      return showHelp();
    }
  };
  showHelp = function() {
    puts(BANNER);
    return process.exit();
  };
  exports.run = function() {
    var args;
    args = process.argv.slice(2);
    switch (args.length) {
      case 0:
        load("build");
        break;
      case 1:
        if (args[0] === "--help") {
          showHelp();
        } else {
          load(args[0]);
        }
        break;
      case 2:
        watch({
          source: args[0],
          target: args[1]
        });
        break;
      default:
        showHelp();
    }
    setInterval(function() {
      var _i, _len, _ref2, _result, watcher;
      _result = []; _ref2 = Jitter.watching;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        watcher = _ref2[_i];
        _result.push(watcher.rootCompile());
      }
      return _result;
    }, 500);
    return puts("Watching for changes and new files.  Press Ctrl+C to stop.");
  };
}).call(this);
