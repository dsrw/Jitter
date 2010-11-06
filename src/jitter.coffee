###
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
###

# External dependencies

fs=            require 'fs'
path=          require 'path'
CoffeeScript=  require 'coffee-script'
{exec}=        require 'child_process'
{puts, print}= require 'sys'
{q}=           require 'sink'

# Banner shown if jitter is run without arguments
BANNER= '''
  Jitter takes a directory of *.coffee files and recursively compiles
  them to *.js files, preserving the original directory structure.

  Jitter also watches for changes and automatically recompiles as
  needed. It even detects new files, unlike the coffee utility.

  If passed a test directory, it will run each test through node on
  each change.

  Usage:
    jitter coffee-path js-path [test-path]
        '''
  
class Jitter
  @compilers: {}
  watchedFiles: {}
  rootCompile: ->
    [@changed, @compiled, @errors] = [[],[], {}]
    @scanDir @source
    q =>
      if @changed.length > 0
        if Object.keys(@errors).length is 0 then @onSuccess()
        else @onError()
  
  scanDir: (directory) ->
    for item in fs.readdirSync directory
      sourcePath = "#{@source}/#{item}"
      mtime = fs.statSync(sourcePath).mtime.valueOf()
      continue if @watchedFiles[sourcePath] is mtime
      if sourcePath.match @pattern
        @watchedFiles[sourcePath] = mtime
        @changed.push sourcePath
        try
          @compile sourcePath if @target
          @onChange sourcePath
        catch err
          @errors[sourcePath] = err
      else if fs.statSync(sourcePath).isDirectory()
        @scanDir sourcePath
        
  onError: ->
    puts "Error in #{name}:\n#{err.message}" for name,err of @errors
  onChange: (file) ->
    puts "Compiled #{file}"
  onSuccess: ->
    puts "finished."

class CoffeeCompiler extends Jitter
  pattern: /\.coffee$/
  compile: (file) -> 
    code = fs.readFileSync(file).toString()
    js = CoffeeScript.compile code, {file}
    jsPath = file.replace(/^#{@source}/, @target).replace(/coffee$/, "js")
    @compiled.push file
    q exec, "mkdir -p #{path.dirname(jsPath)}", -> fs.writeFileSync jsPath, js

Jitter.compilers["coffee"] = CoffeeCompiler

exports.watch = watch = (opts) ->
  class Watcher extends Jitter.compilers[opts.compiler or 'coffee']
    constructor: (args) ->
      (@[name] = func) for name, func of args
      setInterval (=> @rootCompile()), 500
  new Watcher(opts)

load = (file) ->
  eval CoffeeScript.compile(fs.readFileSync(file).toString(), fileName: file)

exports.run = ->
  args = process.argv[2...]
  switch args.length
    when 0
      load 'build.jitter'
    when 1
      load "#{args[0]}.jitter"
    when 2
      watch source:args[0], target:args[1]
