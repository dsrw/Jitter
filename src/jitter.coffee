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

fs=            require "fs"
path=          require "path"
CoffeeScript=  require "coffee-script"
{exec}=        require "child_process"
{puts, print}= require "sys"
{q}=           require "sink"

# Banner shown if jitter is run without arguments
BANNER= """
  Jitter takes a directory of *.coffee files and recursively compiles
  them to *.js files, preserving the original directory structure.

  Jitter also watches for changes and automatically recompiles as
  needed. It even detects new files, unlike the coffee utility.

  If passed a test directory, it will run each test through node on
  each change.

  Usage:
    jitter coffee-path js-path [test-path]
        """
  
class Jitter
  @compilers: {}
  @watching: []
  watchedFiles: {}
  rootCompile: ->
    [@changed, @compiled, @errors] = [[],[], {}]
    @scanDir @source
    q =>
      if @changed.length > 0
        if Object.keys(@errors).length is 0 then @onSuccess?()
        else @onError?()
  
  scanDir: (directory) ->
    for item in fs.readdirSync directory
      sourcePath = "#{directory}/#{item}"
      mtime = fs.statSync(sourcePath).mtime.valueOf()
      continue if @watchedFiles[sourcePath] is mtime
      if fs.statSync(sourcePath).isDirectory()
        @scanDir sourcePath
      else if sourcePath.match @match
        @watchedFiles[sourcePath] = mtime
        @changed.push sourcePath 
        @onChange? sourcePath
        if @target
          targetPath = sourcePath.replace(/^#{@source}/, @target).replace(@match, @targetExtension)
          q exec, "mkdir -p #{path.dirname(targetPath)}", =>
            try
              @compile sourcePath, targetPath
              @compiled.push sourcePath
              @onCompile? sourcePath, targetPath
            catch err
              @errors[file] = err
        
  onError: ->
    for name, err of @errors
      puts "Error in #{name}:\n#{err.message}" for name,err of @errors
      @notifyError name, err.message
  onCompile: (sourceFile, targetFile) ->
    puts "Compiled #{sourceFile}"

#Compilers

Jitter.compilers["coffee"] = class CoffeeCompiler extends Jitter
  match: /\.coffee$/
  targetExtension: ".js"
  compile: (sourcePath, targetPath) -> 
    code = fs.readFileSync(sourcePath).toString()
    js = CoffeeScript.compile code, {sourcePath}
    fs.writeFileSync targetPath, js

#Helpers

Jitter::notifyError = (source, errMessage)->
  basename = source.replace(/^.*[\/\\]/, '')
  if m = errMessage.match /Parse error on line (\d+)/
    message = "Parse error in #{basename}\non line #{m[1]}."
  else
    message = "Error in #{basename}."
  @notify "Compilation failed", message

Jitter::notify = (title, message) ->
  exec "growlnotify -n Jitter -p 2 -t \"#{title}\" -m \"#{message}\""

Jitter::runAll = (command, directory, pattern, callback) ->
  for item in fs.readdirSync directory
    sourcePath = "#{directory}/#{item}"
    if fs.statSync(sourcePath).isDirectory()
      @runAll command, sourcePath, pattern
    else if item.match pattern
      q exec, "#{command} #{sourcePath}", (error, stdout, stderr) ->
        callback sourcePath, stdout, stderr

Jitter::runTests = (command, directory, pattern) ->
  @runAll command, directory, pattern, (test, stdout, stderr) =>
    print stdout
    print stderr
    @notify "Test failed: #{test}", stderr if stderr

CoffeeCompiler::runTests = (directory) ->
  directory or= "test"
  super "coffee", directory, /^test.*\.coffee$/
  
#Command line

watch = (opts) ->
  class Watcher extends Jitter.compilers[opts.compiler or "coffee"]
    constructor: -> (@[name] = func) for name, func of opts
  Jitter.watching.push new Watcher()

load = (file) ->
  file = "#{file}.jitter" unless file.match /\.jitter$/
  try
    eval CoffeeScript.compile(fs.readFileSync(file).toString())
  catch err
    puts err.message + "\n"
    showHelp()

showHelp = ->
  puts BANNER
  process.exit()

exports.run = ->
  args = process.argv[2...]
  switch args.length
    when 0 then load "build"
    when 1
      if args[0] is "--help" then showHelp() else load args[0]
    when 2 then watch source:args[0], target:args[1]
    else showHelp()
  setInterval (-> watcher.rootCompile() for watcher in Jitter.watching), 500
  puts "Watching for changes and new files.  Press Ctrl+C to stop."
