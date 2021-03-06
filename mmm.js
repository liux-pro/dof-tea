

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// See https://caniuse.com/mdn-javascript_builtins_object_assign
var objAssign = Object.assign;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = objAssign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

// Normally we don't log exceptions but instead let them bubble out the top
// level where the embedding environment (e.g. the browser) can handle
// them.
// However under v8 and node we sometimes exit the process direcly in which case
// its up to use us to log the exception before exiting.
// If we fix https://github.com/emscripten-core/emscripten/issues/15080
// this may no longer be needed under node.
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  let toLog = e;
  if (e && typeof e === 'object' && e.stack) {
    toLog = [e, e.stack];
  }
  err('exiting due to exception: ' + toLog);
}

var fs;
var nodePath;
var requireNodeFS;

if (ENVIRONMENT_IS_NODE) {
  if (!(typeof process === 'object' && typeof require === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


requireNodeFS = function() {
  // Use nodePath as the indicator for these not being initialized,
  // since in some environments a global fs may have already been
  // created.
  if (!nodePath) {
    fs = require('fs');
    nodePath = require('path');
  }
}

read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  requireNodeFS();
  filename = nodePath['normalize'](filename);
  return fs.readFileSync(filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = function readAsync(filename, onload, onerror) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    onload(ret);
  }
  requireNodeFS();
  filename = nodePath['normalize'](filename);
  fs.readFile(filename, function(err, data) {
    if (err) onerror(err);
    else onload(data.buffer);
  });
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  // Without this older versions of node (< v15) will log unhandled rejections
  // but return 0, which is not normally the desired behaviour.  This is
  // not be needed with node v15 and about because it is now the default
  // behaviour:
  // See https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode
  process['on']('unhandledRejection', function(reason) { throw reason; });

  quit_ = (status, toThrow) => {
    if (keepRuntimeAlive()) {
      process['exitCode'] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process === 'object' && typeof require === 'function') || typeof window === 'object' || typeof importScripts === 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      const data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    let data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  readAsync = function readAsync(f, onload, onerror) {
    setTimeout(() => onload(readBinary(f)), 0);
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = (status, toThrow) => {
      logExceptionOnExit(toThrow);
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window === 'object' || typeof importScripts === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {
// include: web_or_worker_shell_read.js


  read_ = function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = (title) => document.title = title;
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
objAssign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];
if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) {
  Object.defineProperty(Module, 'arguments', {
    configurable: true,
    get: function() {
      abort('Module.arguments has been replaced with plain arguments_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['thisProgram']) thisProgram = Module['thisProgram'];
if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) {
  Object.defineProperty(Module, 'thisProgram', {
    configurable: true,
    get: function() {
      abort('Module.thisProgram has been replaced with plain thisProgram (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['quit']) quit_ = Module['quit'];
if (!Object.getOwnPropertyDescriptor(Module, 'quit')) {
  Object.defineProperty(Module, 'quit', {
    configurable: true,
    get: function() {
      abort('Module.quit has been replaced with plain quit_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
assert(typeof Module['TOTAL_MEMORY'] === 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');

if (!Object.getOwnPropertyDescriptor(Module, 'read')) {
  Object.defineProperty(Module, 'read', {
    configurable: true,
    get: function() {
      abort('Module.read has been replaced with plain read_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) {
  Object.defineProperty(Module, 'readAsync', {
    configurable: true,
    get: function() {
      abort('Module.readAsync has been replaced with plain readAsync (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) {
  Object.defineProperty(Module, 'readBinary', {
    configurable: true,
    get: function() {
      abort('Module.readBinary has been replaced with plain readBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) {
  Object.defineProperty(Module, 'setWindowTitle', {
    configurable: true,
    get: function() {
      abort('Module.setWindowTitle has been replaced with plain setWindowTitle (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';
function alignMemory() { abort('`alignMemory` is now a library function and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line'); }

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-s ENVIRONMENT` to enable.");




var STACK_ALIGN = 16;
var POINTER_SIZE = 4;

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length - 1] === '*') {
        return POINTER_SIZE;
      } else if (type[0] === 'i') {
        const bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {
  return func;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

function updateTableMap(offset, count) {
  for (var i = offset; i < offset + count; i++) {
    var item = getWasmTableEntry(i);
    // Ignore null values.
    if (item) {
      functionsInTableMap.set(item, i);
    }
  }
}

// Add a function to the table.
// 'sig' parameter is required if the function being added is a JS function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    updateTableMap(0, wasmTable.length);
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(getWasmTableEntry(index));
  freeTableIndexes.push(index);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) {
  Object.defineProperty(Module, 'wasmBinary', {
    configurable: true,
    get: function() {
      abort('Module.wasmBinary has been replaced with plain wasmBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var noExitRuntime = Module['noExitRuntime'] || true;
if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) {
  Object.defineProperty(Module, 'noExitRuntime', {
    configurable: true,
    get: function() {
      abort('Module.noExitRuntime has been replaced with plain noExitRuntime (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// include: wasm2js.js


// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
/** @suppress{duplicate, const} */
var
WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  Memory: function(opts) {
    this.buffer = new ArrayBuffer(opts['initial'] * 65536);
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
  },

  Instance: function(module, info) {
    // TODO: use the module and info somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(asmLibraryArg) {
function Table(ret) {
  // grow method not included; table is not growable
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 1024, "JTAyeCUwMnglMDJ4JTAyeAAtKyAgIDBYMHgALTBYKzBYIDBYLTB4KzB4IDB4AG5hbgB0cm9xa2RkbXRyb3FrY2RtAGluZgBlOGIxMGMxZjhiYzM1OTViZThiMTBjMWY4YmMzNTk1YgBOQU4ASU5GAC4AKG51bGwpAAAAAAAAAAAZAAoAGRkZAAAAAAUAAAAAAAAJAAAAAAsAAAAAAAAAABkAEQoZGRkDCgcAAQAJCxgAAAkGCwAACwAGGQAAABkZGQAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAZAAoNGRkZAA0AAAIACQ4AAAAJAA4AAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAEwAAAAATAAAAAAkMAAAAAAAMAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA8AAAAEDwAAAAAJEAAAAAAAEAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAARAAAAABEAAAAACRIAAAAAABIAABIAABoAAAAaGhoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGgAAABoaGgAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAABcAAAAAFwAAAAAJFAAAAAAAFAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWAAAAAAAAAAAAAAAVAAAAABUAAAAACRYAAAAAABYAABYAADAxMjM0NTY3ODlBQkNERUY=");
  base64DecodeToExistingUint8Array(bufferView, 1632, "MgQAAEcEAAAFAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAABgAAAOQHAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAA//////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABoBgAAYA5QAAUAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAIAAAAWAoAAAAEAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAD/////CgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAA=");
  base64DecodeToExistingUint8Array(bufferView, 1952, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==");
}

  var scratchBuffer = new ArrayBuffer(16);
  var i32ScratchView = new Int32Array(scratchBuffer);
  var f32ScratchView = new Float32Array(scratchBuffer);
  var f64ScratchView = new Float64Array(scratchBuffer);
  
  function wasm2js_scratch_load_i32(index) {
    return i32ScratchView[index];
  }
      
  function wasm2js_scratch_store_i32(index, value) {
    i32ScratchView[index] = value;
  }
      
  function wasm2js_scratch_load_f64() {
    return f64ScratchView[0];
  }
      
  function wasm2js_scratch_store_f64(value) {
    f64ScratchView[0] = value;
  }
      
function asmFunc(env) {
 var memory = env.memory;
 var buffer = memory.buffer;
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var abort = env.abort;
 var nan = NaN;
 var infinity = Infinity;
 var fimport$0 = env.fd_close;
 var fimport$1 = env.fd_write;
 var fimport$2 = env.emscripten_resize_heap;
 var fimport$3 = env.emscripten_memcpy_big;
 var fimport$4 = env.setTempRet0;
 var fimport$5 = env.fd_seek;
 var global$0 = 5246560;
 var global$1 = 0;
 var global$2 = 0;
 var __wasm_intrinsics_temp_i64 = 0;
 var __wasm_intrinsics_temp_i64$hi = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function $0() {
  $68();
  $43();
 }
 
 function $1($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0;
  $4_1 = global$0 - 16 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  $2($4_1 | 0, HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0);
  global$0 = $4_1 + 16 | 0;
  return;
 }
 
 function $2($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, $6_1 = 0;
  $5_1 = global$0 - 96 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 92 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 88 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 84 | 0) >> 2] = $2_1;
  $6_1 = HEAP32[($5_1 + 92 | 0) >> 2] | 0;
  HEAP8[(HEAP32[($5_1 + 84 | 0) >> 2] | 0) >> 0] = 0;
  $3($6_1 | 0, HEAP32[($5_1 + 88 | 0) >> 2] | 0 | 0, $5_1 | 0);
  $10(HEAP32[($5_1 + 84 | 0) >> 2] | 0 | 0, $5_1 | 0) | 0;
  $10(HEAP32[($5_1 + 84 | 0) >> 2] | 0 | 0, HEAP32[(0 + 1636 | 0) >> 2] | 0 | 0) | 0;
  global$0 = $5_1 + 96 | 0;
  return;
 }
 
 function $3($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$5 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, $6_1 = 0, $5_1 = 0, $51$hi = 0, $52$hi = 0, $75 = 0, $55$hi = 0, $56$hi = 0, $57$hi = 0, $76 = 0, $58$hi = 0, $59$hi = 0, $61$hi = 0, $65$hi = 0, $66$hi = 0, $67$hi = 0, $69$hi = 0, $70$hi = 0, $71$hi = 0, $73$hi = 0, $74$hi = 0, $77$hi = 0, $78$hi = 0, $81$hi = 0, $82$hi = 0, $77 = 0, $85$hi = 0, $86$hi = 0, $87$hi = 0, $78 = 0, $88$hi = 0, $89$hi = 0, $91$hi = 0, $98$hi = 0, $99$hi = 0, $100$hi = 0, $102$hi = 0, $103$hi = 0, $104$hi = 0, $106$hi = 0, $107$hi = 0, $131 = 0, $141 = 0, $55_1 = 0, $181 = 0, $184 = 0, $203 = 0, $65_1 = 0, $66_1 = 0, $211 = 0, $69_1 = 0, $70_1 = 0, $221 = 0, $227 = 0, $230 = 0, $236 = 0, $246 = 0, $85 = 0, $270 = 0, $276 = 0, $28_1 = 0, $306 = 0, $98 = 0, $99 = 0, $314 = 0, $102 = 0, $103 = 0, $324 = 0, $330 = 0, $333 = 0, $339 = 0;
  $5_1 = global$0 - 64 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 52 | 0) >> 2] = $2_1;
  $6_1 = HEAP32[($5_1 + 60 | 0) >> 2] | 0;
  i64toi32_i32$0 = $5($6_1 | 0, HEAP32[($5_1 + 56 | 0) >> 2] | 0 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $131 = i64toi32_i32$0;
  i64toi32_i32$0 = $5_1;
  HEAP32[(i64toi32_i32$0 + 40 | 0) >> 2] = $131;
  HEAP32[(i64toi32_i32$0 + 44 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$1 = $5($6_1 | 0, (HEAP32[(i64toi32_i32$0 + 56 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $141 = i64toi32_i32$1;
  i64toi32_i32$1 = $5_1;
  HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] = $141;
  HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0) < (32 | 0) & 1 | 0)) {
     break label$1
    }
    i64toi32_i32$2 = $5_1;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 32 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 36 | 0) >> 2] | 0;
    $51$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $52$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $51$hi;
    i64toi32_i32$1 = $52$hi;
    i64toi32_i32$1 = $51$hi;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$0 = $52$hi;
    i64toi32_i32$3 = 4;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $75 = 0;
    } else {
     i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $75 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    i64toi32_i32$0 = $6($6_1 | 0, $75 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    i64toi32_i32$2 = $6($6_1 | 0, i64toi32_i32$0 | 0, i64toi32_i32$2 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $55_1 = i64toi32_i32$2;
    $55$hi = i64toi32_i32$0;
    i64toi32_i32$1 = $5_1;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0;
    $56$hi = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    $57$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $56$hi;
    i64toi32_i32$2 = $57$hi;
    i64toi32_i32$2 = $56$hi;
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$0 = $57$hi;
    i64toi32_i32$3 = 5;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$2 >> 31 | 0;
     $76 = i64toi32_i32$2 >> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$2 >> i64toi32_i32$4 | 0;
     $76 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
    }
    $58$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $59$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $58$hi;
    i64toi32_i32$0 = $59$hi;
    i64toi32_i32$0 = $58$hi;
    i64toi32_i32$2 = $76;
    i64toi32_i32$1 = $59$hi;
    i64toi32_i32$3 = 134217727;
    i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
    i64toi32_i32$1 = $6($6_1 | 0, i64toi32_i32$2 & i64toi32_i32$3 | 0 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $61$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $55$hi;
    i64toi32_i32$2 = $61$hi;
    $181 = i64toi32_i32$1;
    i64toi32_i32$2 = $55$hi;
    i64toi32_i32$0 = $55_1;
    i64toi32_i32$1 = $61$hi;
    i64toi32_i32$3 = $181;
    i64toi32_i32$1 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
    $184 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $5_1;
    HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $184;
    HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$1;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] | 0;
    i64toi32_i32$0 = $7($6_1 | 0, HEAP32[(0 + 1632 | 0) >> 2] | 0 | 0, (i64toi32_i32$1 & 3 | 0) << 2 | 0 | 0, 4 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $203 = i64toi32_i32$0;
    i64toi32_i32$0 = i64toi32_i32$2;
    HEAP32[i64toi32_i32$0 >> 2] = $203;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 40 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$0 + 44 | 0) >> 2] | 0;
    $65_1 = i64toi32_i32$1;
    $65$hi = i64toi32_i32$0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
    $66_1 = i64toi32_i32$0;
    $66$hi = i64toi32_i32$1;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 32 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 36 | 0) >> 2] | 0;
    $67$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $66$hi;
    i64toi32_i32$0 = $67$hi;
    $211 = i64toi32_i32$1;
    i64toi32_i32$0 = $66$hi;
    i64toi32_i32$2 = $66_1;
    i64toi32_i32$1 = $67$hi;
    i64toi32_i32$3 = $211;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$4 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $69_1 = i64toi32_i32$5;
    $69$hi = i64toi32_i32$2;
    i64toi32_i32$0 = $5_1;
    i64toi32_i32$2 = HEAP32[i64toi32_i32$0 >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
    $70_1 = i64toi32_i32$2;
    $70$hi = i64toi32_i32$5;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] | 0;
    $71$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $70$hi;
    i64toi32_i32$2 = $71$hi;
    $221 = i64toi32_i32$5;
    i64toi32_i32$2 = $70$hi;
    i64toi32_i32$0 = $70_1;
    i64toi32_i32$5 = $71$hi;
    i64toi32_i32$3 = $221;
    i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    i64toi32_i32$4 = $6($6_1 | 0, i64toi32_i32$1 | 0, i64toi32_i32$4 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $73$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $69$hi;
    i64toi32_i32$0 = $73$hi;
    $227 = i64toi32_i32$4;
    i64toi32_i32$0 = $69$hi;
    i64toi32_i32$2 = $69_1;
    i64toi32_i32$4 = $73$hi;
    i64toi32_i32$3 = $227;
    i64toi32_i32$4 = i64toi32_i32$0 ^ i64toi32_i32$4 | 0;
    $74$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $65$hi;
    i64toi32_i32$4 = $74$hi;
    $230 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$4 = $65$hi;
    i64toi32_i32$0 = $65_1;
    i64toi32_i32$2 = $74$hi;
    i64toi32_i32$3 = $230;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    i64toi32_i32$1 = $6($6_1 | 0, i64toi32_i32$5 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $236 = i64toi32_i32$1;
    i64toi32_i32$1 = $5_1;
    HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] = $236;
    HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$4 = i64toi32_i32$1;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] | 0;
    $77$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $78$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $77$hi;
    i64toi32_i32$1 = $78$hi;
    i64toi32_i32$1 = $77$hi;
    i64toi32_i32$4 = i64toi32_i32$0;
    i64toi32_i32$0 = $78$hi;
    i64toi32_i32$3 = -1640531527;
    i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$2 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $246 = i64toi32_i32$5;
    i64toi32_i32$5 = $5_1;
    HEAP32[(i64toi32_i32$5 + 24 | 0) >> 2] = $246;
    HEAP32[(i64toi32_i32$5 + 28 | 0) >> 2] = i64toi32_i32$4;
    i64toi32_i32$1 = i64toi32_i32$5;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0;
    $81$hi = i64toi32_i32$5;
    i64toi32_i32$5 = 0;
    $82$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $81$hi;
    i64toi32_i32$5 = $82$hi;
    i64toi32_i32$5 = $81$hi;
    i64toi32_i32$1 = i64toi32_i32$4;
    i64toi32_i32$4 = $82$hi;
    i64toi32_i32$3 = 4;
    i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
     $77 = 0;
    } else {
     i64toi32_i32$4 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$0 | 0) | 0;
     $77 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
    }
    i64toi32_i32$4 = $6($6_1 | 0, $77 | 0, i64toi32_i32$4 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    i64toi32_i32$1 = $6($6_1 | 0, i64toi32_i32$4 | 0, i64toi32_i32$1 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $85 = i64toi32_i32$1;
    $85$hi = i64toi32_i32$4;
    i64toi32_i32$5 = $5_1;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$5 + 40 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$5 + 44 | 0) >> 2] | 0;
    $86$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $87$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $86$hi;
    i64toi32_i32$1 = $87$hi;
    i64toi32_i32$1 = $86$hi;
    i64toi32_i32$5 = i64toi32_i32$4;
    i64toi32_i32$4 = $87$hi;
    i64toi32_i32$3 = 5;
    i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$1 >> 31 | 0;
     $78 = i64toi32_i32$1 >> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$4 = i64toi32_i32$1 >> i64toi32_i32$0 | 0;
     $78 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$0 | 0) | 0;
    }
    $88$hi = i64toi32_i32$4;
    i64toi32_i32$4 = 0;
    $89$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $88$hi;
    i64toi32_i32$4 = $89$hi;
    i64toi32_i32$4 = $88$hi;
    i64toi32_i32$1 = $78;
    i64toi32_i32$5 = $89$hi;
    i64toi32_i32$3 = 134217727;
    i64toi32_i32$5 = i64toi32_i32$4 & i64toi32_i32$5 | 0;
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$1 & i64toi32_i32$3 | 0 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $91$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $85$hi;
    i64toi32_i32$1 = $91$hi;
    $270 = i64toi32_i32$5;
    i64toi32_i32$1 = $85$hi;
    i64toi32_i32$4 = $85;
    i64toi32_i32$5 = $91$hi;
    i64toi32_i32$3 = $270;
    i64toi32_i32$5 = i64toi32_i32$1 ^ i64toi32_i32$5 | 0;
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$4 ^ i64toi32_i32$3 | 0 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $276 = i64toi32_i32$5;
    i64toi32_i32$5 = $5_1;
    HEAP32[(i64toi32_i32$5 + 8 | 0) >> 2] = $276;
    HEAP32[(i64toi32_i32$5 + 12 | 0) >> 2] = i64toi32_i32$4;
    $28_1 = HEAP32[(0 + 1632 | 0) >> 2] | 0;
    i64toi32_i32$1 = i64toi32_i32$5;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] | 0;
    i64toi32_i32$4 = i64toi32_i32$4 >> 11 | 0;
    i64toi32_i32$5 = i64toi32_i32$4 >> 31 | 0;
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$4 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    i64toi32_i32$4 = $7($6_1 | 0, $28_1 | 0, (i64toi32_i32$5 & 3 | 0) << 2 | 0 | 0, 4 | 0) | 0;
    i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
    $306 = i64toi32_i32$4;
    i64toi32_i32$4 = i64toi32_i32$1;
    HEAP32[i64toi32_i32$1 >> 2] = $306;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$5;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] | 0;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0;
    $98 = i64toi32_i32$5;
    $98$hi = i64toi32_i32$4;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] | 0;
    $99 = i64toi32_i32$4;
    $99$hi = i64toi32_i32$5;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$1 + 40 | 0) >> 2] | 0;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0;
    $100$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $99$hi;
    i64toi32_i32$4 = $100$hi;
    $314 = i64toi32_i32$5;
    i64toi32_i32$4 = $99$hi;
    i64toi32_i32$1 = $99;
    i64toi32_i32$5 = $100$hi;
    i64toi32_i32$3 = $314;
    i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
    i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
    }
    i64toi32_i32$2 = $6($6_1 | 0, i64toi32_i32$0 | 0, i64toi32_i32$2 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $102 = i64toi32_i32$2;
    $102$hi = i64toi32_i32$1;
    i64toi32_i32$4 = $5_1;
    i64toi32_i32$1 = HEAP32[i64toi32_i32$4 >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 4 | 0) >> 2] | 0;
    $103 = i64toi32_i32$1;
    $103$hi = i64toi32_i32$2;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 24 | 0) >> 2] | 0;
    i64toi32_i32$1 = HEAP32[(i64toi32_i32$4 + 28 | 0) >> 2] | 0;
    $104$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $103$hi;
    i64toi32_i32$1 = $104$hi;
    $324 = i64toi32_i32$2;
    i64toi32_i32$1 = $103$hi;
    i64toi32_i32$4 = $103;
    i64toi32_i32$2 = $104$hi;
    i64toi32_i32$3 = $324;
    i64toi32_i32$5 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
    i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
    }
    i64toi32_i32$0 = $6($6_1 | 0, i64toi32_i32$5 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $106$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $102$hi;
    i64toi32_i32$4 = $106$hi;
    $330 = i64toi32_i32$0;
    i64toi32_i32$4 = $102$hi;
    i64toi32_i32$1 = $102;
    i64toi32_i32$0 = $106$hi;
    i64toi32_i32$3 = $330;
    i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
    $107$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $98$hi;
    i64toi32_i32$0 = $107$hi;
    $333 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $98$hi;
    i64toi32_i32$4 = $98;
    i64toi32_i32$1 = $107$hi;
    i64toi32_i32$3 = $333;
    i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    i64toi32_i32$5 = $6($6_1 | 0, i64toi32_i32$2 | 0, i64toi32_i32$5 | 0) | 0;
    i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
    $339 = i64toi32_i32$5;
    i64toi32_i32$5 = $5_1;
    HEAP32[(i64toi32_i32$5 + 32 | 0) >> 2] = $339;
    HEAP32[(i64toi32_i32$5 + 36 | 0) >> 2] = i64toi32_i32$4;
    HEAP32[(i64toi32_i32$5 + 20 | 0) >> 2] = (HEAP32[(i64toi32_i32$5 + 20 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  i64toi32_i32$0 = $5_1;
  i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 40 | 0) >> 2] | 0;
  i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 44 | 0) >> 2] | 0;
  $8($6_1 | 0, i64toi32_i32$4 | 0, i64toi32_i32$5 | 0, HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] | 0 | 0);
  i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 32 | 0) >> 2] | 0;
  i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 36 | 0) >> 2] | 0;
  $8($6_1 | 0, i64toi32_i32$5 | 0, i64toi32_i32$4 | 0, (HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] | 0) + 8 | 0 | 0);
  global$0 = i64toi32_i32$0 + 64 | 0;
  return;
 }
 
 function $4($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $8_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 8 | 0) >> 2] = $49(100 | 0) | 0;
  $1(HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0);
  $8_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
  global$0 = $3_1 + 16 | 0;
  return $8_1 | 0;
 }
 
 function $5($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$5 = 0, i64toi32_i32$3 = 0, $4_1 = 0, $41$hi = 0, $42$hi = 0, $43$hi = 0, $44$hi = 0, $45$hi = 0, $46$hi = 0, $41_1 = 0, $130 = 0, $135 = 0, $140 = 0;
  $4_1 = global$0 - 48 | 0;
  HEAP32[($4_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 36 | 0) >> 2] = HEAP32[($4_1 + 40 | 0) >> 2] | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$1 = $4_1;
  HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] = (((HEAPU8[(HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0) >> 0] | 0) & 255 | 0) & -1 | 0) << 24 | 0;
  HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = (((HEAPU8[((HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0) & 255 | 0) & -1 | 0) << 16 | 0;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = (((HEAPU8[((HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0) + 2 | 0) >> 0] | 0) & 255 | 0) & -1 | 0) << 8 | 0;
  HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[i64toi32_i32$1 >> 2] = (HEAPU8[((HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0) + 3 | 0) >> 0] | 0) & 255 | 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] | 0;
  $41_1 = i64toi32_i32$0;
  $41$hi = i64toi32_i32$1;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 16 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 20 | 0) >> 2] | 0;
  $42$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $41$hi;
  i64toi32_i32$0 = $42$hi;
  $130 = i64toi32_i32$1;
  i64toi32_i32$0 = $41$hi;
  i64toi32_i32$2 = $41_1;
  i64toi32_i32$1 = $42$hi;
  i64toi32_i32$3 = $130;
  i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
  if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $43$hi = i64toi32_i32$5;
  i64toi32_i32$0 = $4_1;
  i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] | 0;
  $44$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $43$hi;
  i64toi32_i32$2 = $44$hi;
  $135 = i64toi32_i32$5;
  i64toi32_i32$2 = $43$hi;
  i64toi32_i32$0 = i64toi32_i32$4;
  i64toi32_i32$5 = $44$hi;
  i64toi32_i32$3 = $135;
  i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
  }
  $45$hi = i64toi32_i32$4;
  i64toi32_i32$2 = $4_1;
  i64toi32_i32$4 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $46$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $45$hi;
  i64toi32_i32$0 = $46$hi;
  $140 = i64toi32_i32$4;
  i64toi32_i32$0 = $45$hi;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$4 = $46$hi;
  i64toi32_i32$3 = $140;
  i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
  if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
  }
  i64toi32_i32$2 = i64toi32_i32$5;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function $6($0_1, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $4_1 = 0, $5$hi = 0, $6$hi = 0;
  $4_1 = global$0 - 16 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$1 = $4_1;
  HEAP32[i64toi32_i32$1 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$1 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] | 0;
  $5$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $6$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$1 = $6$hi;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $6$hi;
  i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 & -1 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$2 | 0;
 }
 
 function $7($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $6_1 = 0, i64toi32_i32$5 = 0, $30$hi = 0, $31$hi = 0, $27_1 = 0, $33$hi = 0, $34$hi = 0, $28_1 = 0, $36$hi = 0, $37$hi = 0, $29_1 = 0, $39$hi = 0, $40$hi = 0, $41$hi = 0, $42$hi = 0, $43$hi = 0, $44$hi = 0, $39_1 = 0, $137 = 0, $142 = 0, $147 = 0;
  $6_1 = global$0 - 64 | 0;
  HEAP32[($6_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($6_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($6_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($6_1 + 48 | 0) >> 2] = $3_1;
  HEAP32[($6_1 + 44 | 0) >> 2] = (HEAP32[($6_1 + 56 | 0) >> 2] | 0) + (HEAP32[($6_1 + 52 | 0) >> 2] | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$1 = $6_1;
  HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] = (HEAPU8[(HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0) >> 0] | 0) & 255 | 0;
  HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] = (HEAPU8[((HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0) & 255 | 0;
  HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = (HEAPU8[((HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0) + 2 | 0) >> 0] | 0) & 255 | 0;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] = (HEAPU8[((HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] | 0) + 3 | 0) >> 0] | 0) & 255 | 0;
  HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] | 0;
  $30$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $31$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $30$hi;
  i64toi32_i32$1 = $31$hi;
  i64toi32_i32$1 = $30$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $31$hi;
  i64toi32_i32$3 = 24;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $27_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $27_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  i64toi32_i32$2 = $6_1;
  HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] = $27_1;
  HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] | 0;
  $33$hi = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  $34$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $33$hi;
  i64toi32_i32$2 = $34$hi;
  i64toi32_i32$2 = $33$hi;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$0 = $34$hi;
  i64toi32_i32$3 = 16;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $28_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $28_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  i64toi32_i32$1 = $6_1;
  HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] = $28_1;
  HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 24 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 28 | 0) >> 2] | 0;
  $36$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $37$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $36$hi;
  i64toi32_i32$1 = $37$hi;
  i64toi32_i32$1 = $36$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $37$hi;
  i64toi32_i32$3 = 8;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $29_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
   $29_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  i64toi32_i32$2 = $6_1;
  HEAP32[(i64toi32_i32$2 + 24 | 0) >> 2] = $29_1;
  HEAP32[(i64toi32_i32$2 + 28 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] | 0;
  $39_1 = i64toi32_i32$0;
  $39$hi = i64toi32_i32$2;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 16 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 20 | 0) >> 2] | 0;
  $40$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $39$hi;
  i64toi32_i32$0 = $40$hi;
  $137 = i64toi32_i32$2;
  i64toi32_i32$0 = $39$hi;
  i64toi32_i32$1 = $39_1;
  i64toi32_i32$2 = $40$hi;
  i64toi32_i32$3 = $137;
  i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
  if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
  }
  $41$hi = i64toi32_i32$5;
  i64toi32_i32$0 = $6_1;
  i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 28 | 0) >> 2] | 0;
  $42$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $41$hi;
  i64toi32_i32$1 = $42$hi;
  $142 = i64toi32_i32$5;
  i64toi32_i32$1 = $41$hi;
  i64toi32_i32$0 = i64toi32_i32$4;
  i64toi32_i32$5 = $42$hi;
  i64toi32_i32$3 = $142;
  i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
  i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$5 | 0;
  if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
  }
  $43$hi = i64toi32_i32$4;
  i64toi32_i32$1 = $6_1;
  i64toi32_i32$4 = HEAP32[(i64toi32_i32$1 + 32 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 36 | 0) >> 2] | 0;
  $44$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $43$hi;
  i64toi32_i32$0 = $44$hi;
  $147 = i64toi32_i32$4;
  i64toi32_i32$0 = $43$hi;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$4 = $44$hi;
  i64toi32_i32$3 = $147;
  i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
  i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
  if (i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
  }
  i64toi32_i32$1 = i64toi32_i32$5;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$2;
  return i64toi32_i32$1 | 0;
 }
 
 function $8($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $5_1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $18$hi = 0, $19$hi = 0, $20$hi = 0, $21$hi = 0, $28_1 = 0, $23$hi = 0, $24$hi = 0, $25$hi = 0, $26$hi = 0, $29_1 = 0, $28$hi = 0, $29$hi = 0, $30$hi = 0, $31$hi = 0, $30_1 = 0, $33$hi = 0, $34$hi = 0, $10_1 = 0, $11_1 = 0, $12_1 = 0, $13_1 = 0;
  $5_1 = global$0 - 64 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 60 | 0) >> 2] = $0_1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$1 = $5_1;
  HEAP32[(i64toi32_i32$1 + 48 | 0) >> 2] = $1_1;
  HEAP32[(i64toi32_i32$1 + 52 | 0) >> 2] = i64toi32_i32$0;
  HEAP32[(i64toi32_i32$1 + 44 | 0) >> 2] = $2_1;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 48 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 52 | 0) >> 2] | 0;
  $18$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $19$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $18$hi;
  i64toi32_i32$1 = $19$hi;
  i64toi32_i32$1 = $18$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $19$hi;
  i64toi32_i32$3 = -16777216;
  i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
  $20$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $21$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $20$hi;
  i64toi32_i32$0 = $21$hi;
  i64toi32_i32$0 = $20$hi;
  i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  i64toi32_i32$2 = $21$hi;
  i64toi32_i32$3 = 24;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 >> 31 | 0;
   $28_1 = i64toi32_i32$0 >> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >> i64toi32_i32$4 | 0;
   $28_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  HEAP32[($5_1 + 40 | 0) >> 2] = $28_1;
  i64toi32_i32$0 = $5_1;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 48 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] | 0;
  $23$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $24$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $23$hi;
  i64toi32_i32$1 = $24$hi;
  i64toi32_i32$1 = $23$hi;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$2 = $24$hi;
  i64toi32_i32$3 = 16711680;
  i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
  $25$hi = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  $26$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $25$hi;
  i64toi32_i32$2 = $26$hi;
  i64toi32_i32$2 = $25$hi;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
  i64toi32_i32$0 = $26$hi;
  i64toi32_i32$3 = 16;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$2 >> 31 | 0;
   $29_1 = i64toi32_i32$2 >> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$0 = i64toi32_i32$2 >> i64toi32_i32$4 | 0;
   $29_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  HEAP32[($5_1 + 36 | 0) >> 2] = $29_1;
  i64toi32_i32$2 = $5_1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 48 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 52 | 0) >> 2] | 0;
  $28$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $29$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $28$hi;
  i64toi32_i32$1 = $29$hi;
  i64toi32_i32$1 = $28$hi;
  i64toi32_i32$2 = i64toi32_i32$0;
  i64toi32_i32$0 = $29$hi;
  i64toi32_i32$3 = 65280;
  i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
  $30$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $31$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $30$hi;
  i64toi32_i32$0 = $31$hi;
  i64toi32_i32$0 = $30$hi;
  i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  i64toi32_i32$2 = $31$hi;
  i64toi32_i32$3 = 8;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = i64toi32_i32$0 >> 31 | 0;
   $30_1 = i64toi32_i32$0 >> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >> i64toi32_i32$4 | 0;
   $30_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  HEAP32[($5_1 + 32 | 0) >> 2] = $30_1;
  i64toi32_i32$0 = $5_1;
  i64toi32_i32$2 = HEAP32[(i64toi32_i32$0 + 48 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$0 + 52 | 0) >> 2] | 0;
  $33$hi = i64toi32_i32$1;
  i64toi32_i32$1 = 0;
  $34$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $33$hi;
  i64toi32_i32$1 = $34$hi;
  i64toi32_i32$1 = $33$hi;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$2 = $34$hi;
  i64toi32_i32$3 = 255;
  i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
  HEAP32[($5_1 + 28 | 0) >> 2] = i64toi32_i32$0 & i64toi32_i32$3 | 0;
  $10_1 = HEAP32[($5_1 + 44 | 0) >> 2] | 0;
  $11_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
  $12_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
  $13_1 = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
  HEAP32[($5_1 + 12 | 0) >> 2] = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
  HEAP32[($5_1 + 8 | 0) >> 2] = $13_1;
  HEAP32[($5_1 + 4 | 0) >> 2] = $12_1;
  HEAP32[$5_1 >> 2] = $11_1;
  $9($10_1 | 0, 1024 | 0, $5_1 | 0) | 0;
  global$0 = $5_1 + 64 | 0;
  return;
 }
 
 function $9($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $2_1;
  $2_1 = $33($0_1 | 0, $1_1 | 0, $2_1 | 0) | 0;
  global$0 = $3_1 + 16 | 0;
  return $2_1 | 0;
 }
 
 function $10($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $12($0_1 + ($64($0_1 | 0) | 0) | 0 | 0, $1_1 | 0) | 0;
  return $0_1 | 0;
 }
 
 function $11($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  label$1 : {
   label$2 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break label$2
    }
    label$3 : {
     if (!($1_1 & 3 | 0)) {
      break label$3
     }
     label$4 : while (1) {
      $2_1 = HEAPU8[$1_1 >> 0] | 0;
      HEAP8[$0_1 >> 0] = $2_1;
      if (!$2_1) {
       break label$1
      }
      $0_1 = $0_1 + 1 | 0;
      $1_1 = $1_1 + 1 | 0;
      if ($1_1 & 3 | 0) {
       continue label$4
      }
      break label$4;
     };
    }
    $2_1 = HEAP32[$1_1 >> 2] | 0;
    if ((($2_1 ^ -1 | 0) & ($2_1 + -16843009 | 0) | 0) & -2139062144 | 0) {
     break label$2
    }
    label$5 : while (1) {
     HEAP32[$0_1 >> 2] = $2_1;
     $2_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
     $0_1 = $0_1 + 4 | 0;
     $1_1 = $1_1 + 4 | 0;
     if (!((($2_1 ^ -1 | 0) & ($2_1 + -16843009 | 0) | 0) & -2139062144 | 0)) {
      continue label$5
     }
     break label$5;
    };
   }
   $2_1 = HEAPU8[$1_1 >> 0] | 0;
   HEAP8[$0_1 >> 0] = $2_1;
   if (!$2_1) {
    break label$1
   }
   label$6 : while (1) {
    $2_1 = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($0_1 + 1 | 0) >> 0] = $2_1;
    $0_1 = $0_1 + 1 | 0;
    $1_1 = $1_1 + 1 | 0;
    if ($2_1) {
     continue label$6
    }
    break label$6;
   };
  }
  return $0_1 | 0;
 }
 
 function $12($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $11($0_1 | 0, $1_1 | 0) | 0;
  return $0_1 | 0;
 }
 
 function $13() {
  return 1952 | 0;
 }
 
 function $14($0_1) {
  $0_1 = $0_1 | 0;
  return ($0_1 + -48 | 0) >>> 0 < 10 >>> 0 | 0;
 }
 
 function $15($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  $3_1 = ($2_1 | 0) != (0 | 0);
  label$1 : {
   label$2 : {
    label$3 : {
     if (!($0_1 & 3 | 0)) {
      break label$3
     }
     if (!$2_1) {
      break label$3
     }
     $4_1 = $1_1 & 255 | 0;
     label$4 : while (1) {
      if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($4_1 | 0)) {
       break label$2
      }
      $2_1 = $2_1 + -1 | 0;
      $3_1 = ($2_1 | 0) != (0 | 0);
      $0_1 = $0_1 + 1 | 0;
      if (!($0_1 & 3 | 0)) {
       break label$3
      }
      if ($2_1) {
       continue label$4
      }
      break label$4;
     };
    }
    if (!$3_1) {
     break label$1
    }
   }
   label$5 : {
    if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($1_1 & 255 | 0 | 0)) {
     break label$5
    }
    if ($2_1 >>> 0 < 4 >>> 0) {
     break label$5
    }
    $4_1 = Math_imul($1_1 & 255 | 0, 16843009);
    label$6 : while (1) {
     $3_1 = (HEAP32[$0_1 >> 2] | 0) ^ $4_1 | 0;
     if ((($3_1 ^ -1 | 0) & ($3_1 + -16843009 | 0) | 0) & -2139062144 | 0) {
      break label$5
     }
     $0_1 = $0_1 + 4 | 0;
     $2_1 = $2_1 + -4 | 0;
     if ($2_1 >>> 0 > 3 >>> 0) {
      continue label$6
     }
     break label$6;
    };
   }
   if (!$2_1) {
    break label$1
   }
   $3_1 = $1_1 & 255 | 0;
   label$7 : while (1) {
    label$8 : {
     if ((HEAPU8[$0_1 >> 0] | 0 | 0) != ($3_1 | 0)) {
      break label$8
     }
     return $0_1 | 0;
    }
    $0_1 = $0_1 + 1 | 0;
    $2_1 = $2_1 + -1 | 0;
    if ($2_1) {
     continue label$7
    }
    break label$7;
   };
  }
  return 0 | 0;
 }
 
 function $16($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $15($0_1 | 0, 0 | 0, $1_1 | 0) | 0;
  return ($2_1 ? $2_1 - $0_1 | 0 : $1_1) | 0;
 }
 
 function $17($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $3_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, $2_1 = 0, $10_1 = 0, $2$hi = 0;
  label$1 : {
   wasm2js_scratch_store_f64(+$0_1);
   i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
   $2_1 = wasm2js_scratch_load_i32(0 | 0) | 0;
   $2$hi = i64toi32_i32$0;
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 52;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = 0;
    $10_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    $10_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
   }
   $3_1 = $10_1 & 2047 | 0;
   if (($3_1 | 0) == (2047 | 0)) {
    break label$1
   }
   label$2 : {
    if ($3_1) {
     break label$2
    }
    label$3 : {
     label$4 : {
      if ($0_1 != 0.0) {
       break label$4
      }
      $3_1 = 0;
      break label$3;
     }
     $0_1 = +$17(+($0_1 * 18446744073709551615.0), $1_1 | 0);
     $3_1 = (HEAP32[$1_1 >> 2] | 0) + -64 | 0;
    }
    HEAP32[$1_1 >> 2] = $3_1;
    return +$0_1;
   }
   HEAP32[$1_1 >> 2] = $3_1 + -1022 | 0;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = -2146435073;
   i64toi32_i32$3 = -1;
   i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
   i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
   i64toi32_i32$0 = 1071644672;
   i64toi32_i32$3 = 0;
   i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
   wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$1 | i64toi32_i32$3 | 0 | 0);
   wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$0 | 0);
   $0_1 = +wasm2js_scratch_load_f64();
  }
  return +$0_1;
 }
 
 function $18($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $8_1 = 0, $6_1 = 0, $7_1 = 0;
  $5_1 = global$0 - 208 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 204 | 0) >> 2] = $2_1;
  $6_1 = 0;
  $60($5_1 + 160 | 0 | 0, 0 | 0, 40 | 0) | 0;
  HEAP32[($5_1 + 200 | 0) >> 2] = HEAP32[($5_1 + 204 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (($19(0 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0 | 0) >= (0 | 0)) {
     break label$2
    }
    $1_1 = -1;
    break label$1;
   }
   label$3 : {
    if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
     break label$3
    }
    $6_1 = $52($0_1 | 0) | 0;
   }
   $7_1 = HEAP32[$0_1 >> 2] | 0;
   label$4 : {
    if ((HEAP32[($0_1 + 72 | 0) >> 2] | 0 | 0) > (0 | 0)) {
     break label$4
    }
    HEAP32[$0_1 >> 2] = $7_1 & -33 | 0;
   }
   label$5 : {
    label$6 : {
     label$7 : {
      label$8 : {
       if (HEAP32[($0_1 + 48 | 0) >> 2] | 0) {
        break label$8
       }
       HEAP32[($0_1 + 48 | 0) >> 2] = 80;
       HEAP32[($0_1 + 28 | 0) >> 2] = 0;
       HEAP32[($0_1 + 16 | 0) >> 2] = 0;
       HEAP32[($0_1 + 20 | 0) >> 2] = 0;
       $8_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
       HEAP32[($0_1 + 44 | 0) >> 2] = $5_1;
       break label$7;
      }
      $8_1 = 0;
      if (HEAP32[($0_1 + 16 | 0) >> 2] | 0) {
       break label$6
      }
     }
     $2_1 = -1;
     if ($58($0_1 | 0) | 0) {
      break label$5
     }
    }
    $2_1 = $19($0_1 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0;
   }
   $1_1 = $7_1 & 32 | 0;
   label$9 : {
    if (!$8_1) {
     break label$9
    }
    FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
    HEAP32[($0_1 + 48 | 0) >> 2] = 0;
    HEAP32[($0_1 + 44 | 0) >> 2] = $8_1;
    HEAP32[($0_1 + 28 | 0) >> 2] = 0;
    HEAP32[($0_1 + 16 | 0) >> 2] = 0;
    $3_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
    HEAP32[($0_1 + 20 | 0) >> 2] = 0;
    $2_1 = $3_1 ? $2_1 : -1;
   }
   $3_1 = HEAP32[$0_1 >> 2] | 0;
   HEAP32[$0_1 >> 2] = $3_1 | $1_1 | 0;
   $1_1 = $3_1 & 32 | 0 ? -1 : $2_1;
   if (!$6_1) {
    break label$1
   }
   $53($0_1 | 0);
  }
  global$0 = $5_1 + 208 | 0;
  return $1_1 | 0;
 }
 
 function $19($0_1, $1_1, $2_1, $3_1, $4_1, $5_1, $6_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  $6_1 = $6_1 | 0;
  var $7_1 = 0, $14_1 = 0, $15_1 = 0, $20_1 = 0, i64toi32_i32$1 = 0, $13_1 = 0, $12_1 = 0, $17_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, $11_1 = 0, $19_1 = 0, $16_1 = 0, $18_1 = 0, $22_1 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $9_1 = 0, $24_1 = 0, $24$hi = 0, $10_1 = 0, $21_1 = 0, $23_1 = 0, $32_1 = 0, $33_1 = 0, $34_1 = 0, $8_1 = 0, $279 = 0;
  $7_1 = global$0 - 80 | 0;
  global$0 = $7_1;
  HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
  $8_1 = $7_1 + 55 | 0;
  $9_1 = $7_1 + 56 | 0;
  $10_1 = 0;
  $11_1 = 0;
  $1_1 = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : while (1) {
       if (($1_1 | 0) > (2147483647 - $11_1 | 0 | 0)) {
        break label$4
       }
       $11_1 = $1_1 + $11_1 | 0;
       $12_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
       $1_1 = $12_1;
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            $13_1 = HEAPU8[$1_1 >> 0] | 0;
            if (!$13_1) {
             break label$10
            }
            label$11 : while (1) {
             label$12 : {
              label$13 : {
               label$14 : {
                $13_1 = $13_1 & 255 | 0;
                if ($13_1) {
                 break label$14
                }
                $13_1 = $1_1;
                break label$13;
               }
               if (($13_1 | 0) != (37 | 0)) {
                break label$12
               }
               $13_1 = $1_1;
               label$15 : while (1) {
                if ((HEAPU8[($1_1 + 1 | 0) >> 0] | 0 | 0) != (37 | 0)) {
                 break label$13
                }
                $14_1 = $1_1 + 2 | 0;
                HEAP32[($7_1 + 76 | 0) >> 2] = $14_1;
                $13_1 = $13_1 + 1 | 0;
                $15_1 = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
                $1_1 = $14_1;
                if (($15_1 | 0) == (37 | 0)) {
                 continue label$15
                }
                break label$15;
               };
              }
              $1_1 = $13_1 - $12_1 | 0;
              $13_1 = 2147483647 - $11_1 | 0;
              if (($1_1 | 0) > ($13_1 | 0)) {
               break label$4
              }
              label$16 : {
               if (!$0_1) {
                break label$16
               }
               $20($0_1 | 0, $12_1 | 0, $1_1 | 0);
              }
              if ($1_1) {
               continue label$5
              }
              $16_1 = -1;
              $14_1 = 1;
              $15_1 = $14(HEAP8[((HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0 | 0) | 0;
              $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
              label$17 : {
               if (!$15_1) {
                break label$17
               }
               if ((HEAPU8[($1_1 + 2 | 0) >> 0] | 0 | 0) != (36 | 0)) {
                break label$17
               }
               $16_1 = (HEAP8[($1_1 + 1 | 0) >> 0] | 0) + -48 | 0;
               $10_1 = 1;
               $14_1 = 3;
              }
              $1_1 = $1_1 + $14_1 | 0;
              HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
              $17_1 = 0;
              label$18 : {
               label$19 : {
                $18_1 = HEAP8[$1_1 >> 0] | 0;
                $15_1 = $18_1 + -32 | 0;
                if ($15_1 >>> 0 <= 31 >>> 0) {
                 break label$19
                }
                $14_1 = $1_1;
                break label$18;
               }
               $17_1 = 0;
               $14_1 = $1_1;
               $15_1 = 1 << $15_1 | 0;
               if (!($15_1 & 75913 | 0)) {
                break label$18
               }
               label$20 : while (1) {
                $14_1 = $1_1 + 1 | 0;
                HEAP32[($7_1 + 76 | 0) >> 2] = $14_1;
                $17_1 = $15_1 | $17_1 | 0;
                $18_1 = HEAP8[($1_1 + 1 | 0) >> 0] | 0;
                $15_1 = $18_1 + -32 | 0;
                if ($15_1 >>> 0 >= 32 >>> 0) {
                 break label$18
                }
                $1_1 = $14_1;
                $15_1 = 1 << $15_1 | 0;
                if ($15_1 & 75913 | 0) {
                 continue label$20
                }
                break label$20;
               };
              }
              label$21 : {
               label$22 : {
                if (($18_1 | 0) != (42 | 0)) {
                 break label$22
                }
                label$23 : {
                 label$24 : {
                  if (!($14(HEAP8[($14_1 + 1 | 0) >> 0] | 0 | 0) | 0)) {
                   break label$24
                  }
                  $14_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
                  if ((HEAPU8[($14_1 + 2 | 0) >> 0] | 0 | 0) != (36 | 0)) {
                   break label$24
                  }
                  HEAP32[((((HEAP8[($14_1 + 1 | 0) >> 0] | 0) << 2 | 0) + $4_1 | 0) + -192 | 0) >> 2] = 10;
                  $1_1 = $14_1 + 3 | 0;
                  $19_1 = HEAP32[((((HEAP8[($14_1 + 1 | 0) >> 0] | 0) << 3 | 0) + $3_1 | 0) + -384 | 0) >> 2] | 0;
                  $10_1 = 1;
                  break label$23;
                 }
                 if ($10_1) {
                  break label$9
                 }
                 $10_1 = 0;
                 $19_1 = 0;
                 label$25 : {
                  if (!$0_1) {
                   break label$25
                  }
                  $1_1 = HEAP32[$2_1 >> 2] | 0;
                  HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
                  $19_1 = HEAP32[$1_1 >> 2] | 0;
                 }
                 $1_1 = (HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 1 | 0;
                }
                HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
                if (($19_1 | 0) > (-1 | 0)) {
                 break label$21
                }
                $19_1 = 0 - $19_1 | 0;
                $17_1 = $17_1 | 8192 | 0;
                break label$21;
               }
               $19_1 = $21($7_1 + 76 | 0 | 0) | 0;
               if (($19_1 | 0) < (0 | 0)) {
                break label$4
               }
               $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
              }
              $14_1 = 0;
              $20_1 = -1;
              label$26 : {
               label$27 : {
                if ((HEAPU8[$1_1 >> 0] | 0 | 0) == (46 | 0)) {
                 break label$27
                }
                $21_1 = 0;
                break label$26;
               }
               label$28 : {
                if ((HEAPU8[($1_1 + 1 | 0) >> 0] | 0 | 0) != (42 | 0)) {
                 break label$28
                }
                label$29 : {
                 label$30 : {
                  if (!($14(HEAP8[($1_1 + 2 | 0) >> 0] | 0 | 0) | 0)) {
                   break label$30
                  }
                  $15_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
                  if ((HEAPU8[($15_1 + 3 | 0) >> 0] | 0 | 0) != (36 | 0)) {
                   break label$30
                  }
                  HEAP32[((((HEAP8[($15_1 + 2 | 0) >> 0] | 0) << 2 | 0) + $4_1 | 0) + -192 | 0) >> 2] = 10;
                  $1_1 = $15_1 + 4 | 0;
                  $20_1 = HEAP32[((((HEAP8[($15_1 + 2 | 0) >> 0] | 0) << 3 | 0) + $3_1 | 0) + -384 | 0) >> 2] | 0;
                  break label$29;
                 }
                 if ($10_1) {
                  break label$9
                 }
                 label$31 : {
                  label$32 : {
                   if ($0_1) {
                    break label$32
                   }
                   $20_1 = 0;
                   break label$31;
                  }
                  $1_1 = HEAP32[$2_1 >> 2] | 0;
                  HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
                  $20_1 = HEAP32[$1_1 >> 2] | 0;
                 }
                 $1_1 = (HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 2 | 0;
                }
                HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
                $21_1 = ($20_1 ^ -1 | 0) >>> 31 | 0;
                break label$26;
               }
               HEAP32[($7_1 + 76 | 0) >> 2] = $1_1 + 1 | 0;
               $21_1 = 1;
               $20_1 = $21($7_1 + 76 | 0 | 0) | 0;
               $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
              }
              label$33 : while (1) {
               $15_1 = $14_1;
               $22_1 = 28;
               if (((HEAP8[$1_1 >> 0] | 0) + -123 | 0) >>> 0 < -58 >>> 0) {
                break label$3
               }
               $18_1 = $1_1 + 1 | 0;
               HEAP32[($7_1 + 76 | 0) >> 2] = $18_1;
               $14_1 = HEAP8[$1_1 >> 0] | 0;
               $1_1 = $18_1;
               $14_1 = HEAPU8[(($14_1 + Math_imul($15_1, 58) | 0) + 1087 | 0) >> 0] | 0;
               if (($14_1 + -1 | 0) >>> 0 < 8 >>> 0) {
                continue label$33
               }
               break label$33;
              };
              label$34 : {
               label$35 : {
                label$36 : {
                 if (($14_1 | 0) == (27 | 0)) {
                  break label$36
                 }
                 if (!$14_1) {
                  break label$3
                 }
                 label$37 : {
                  if (($16_1 | 0) < (0 | 0)) {
                   break label$37
                  }
                  HEAP32[($4_1 + ($16_1 << 2 | 0) | 0) >> 2] = $14_1;
                  i64toi32_i32$2 = $3_1 + ($16_1 << 3 | 0) | 0;
                  i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
                  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
                  $279 = i64toi32_i32$0;
                  i64toi32_i32$0 = $7_1;
                  HEAP32[($7_1 + 64 | 0) >> 2] = $279;
                  HEAP32[($7_1 + 68 | 0) >> 2] = i64toi32_i32$1;
                  break label$35;
                 }
                 if (!$0_1) {
                  break label$6
                 }
                 $22($7_1 + 64 | 0 | 0, $14_1 | 0, $2_1 | 0, $6_1 | 0);
                 $18_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
                 break label$34;
                }
                if (($16_1 | 0) > (-1 | 0)) {
                 break label$3
                }
               }
               $1_1 = 0;
               if (!$0_1) {
                continue label$5
               }
              }
              $23_1 = $17_1 & -65537 | 0;
              $14_1 = $17_1 & 8192 | 0 ? $23_1 : $17_1;
              $17_1 = 0;
              $16_1 = 1041;
              $22_1 = $9_1;
              label$38 : {
               label$39 : {
                label$40 : {
                 label$41 : {
                  label$42 : {
                   label$43 : {
                    label$44 : {
                     label$45 : {
                      label$46 : {
                       label$47 : {
                        label$48 : {
                         label$49 : {
                          label$50 : {
                           label$51 : {
                            label$52 : {
                             label$53 : {
                              $1_1 = HEAP8[($18_1 + -1 | 0) >> 0] | 0;
                              $1_1 = $15_1 ? (($1_1 & 15 | 0 | 0) == (3 | 0) ? $1_1 & -33 | 0 : $1_1) : $1_1;
                              switch ($1_1 + -88 | 0 | 0) {
                              case 11:
                               break label$38;
                              case 9:
                              case 13:
                              case 14:
                              case 15:
                               break label$39;
                              case 27:
                               break label$44;
                              case 12:
                              case 17:
                               break label$47;
                              case 23:
                               break label$48;
                              case 0:
                              case 32:
                               break label$49;
                              case 24:
                               break label$50;
                              case 22:
                               break label$51;
                              case 29:
                               break label$52;
                              case 1:
                              case 2:
                              case 3:
                              case 4:
                              case 5:
                              case 6:
                              case 7:
                              case 8:
                              case 10:
                              case 16:
                              case 18:
                              case 19:
                              case 20:
                              case 21:
                              case 25:
                              case 26:
                              case 28:
                              case 30:
                              case 31:
                               break label$7;
                              default:
                               break label$53;
                              };
                             }
                             $22_1 = $9_1;
                             label$54 : {
                              switch ($1_1 + -65 | 0 | 0) {
                              case 0:
                              case 4:
                              case 5:
                              case 6:
                               break label$39;
                              case 2:
                               break label$42;
                              case 1:
                              case 3:
                               break label$7;
                              default:
                               break label$54;
                              };
                             }
                             if (($1_1 | 0) == (83 | 0)) {
                              break label$43
                             }
                             break label$8;
                            }
                            $17_1 = 0;
                            $16_1 = 1041;
                            i64toi32_i32$2 = $7_1;
                            i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                            i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                            $24_1 = i64toi32_i32$1;
                            $24$hi = i64toi32_i32$0;
                            break label$46;
                           }
                           $1_1 = 0;
                           label$55 : {
                            switch ($15_1 & 255 | 0 | 0) {
                            case 0:
                             HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                             continue label$5;
                            case 1:
                             HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                             continue label$5;
                            case 2:
                             i64toi32_i32$1 = $11_1;
                             i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                             i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                             HEAP32[i64toi32_i32$1 >> 2] = $11_1;
                             HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
                             continue label$5;
                            case 3:
                             HEAP16[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 1] = $11_1;
                             continue label$5;
                            case 4:
                             HEAP8[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 0] = $11_1;
                             continue label$5;
                            case 6:
                             HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                             continue label$5;
                            case 7:
                             break label$55;
                            default:
                             continue label$5;
                            };
                           }
                           i64toi32_i32$1 = $11_1;
                           i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                           i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                           HEAP32[i64toi32_i32$1 >> 2] = $11_1;
                           HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
                           continue label$5;
                          }
                          $20_1 = $20_1 >>> 0 > 8 >>> 0 ? $20_1 : 8;
                          $14_1 = $14_1 | 8 | 0;
                          $1_1 = 120;
                         }
                         i64toi32_i32$2 = $7_1;
                         i64toi32_i32$0 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                         i64toi32_i32$1 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                         $12_1 = $23(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, $9_1 | 0, $1_1 & 32 | 0 | 0) | 0;
                         $17_1 = 0;
                         $16_1 = 1041;
                         i64toi32_i32$2 = $7_1;
                         i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                         i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                         if (!(i64toi32_i32$1 | i64toi32_i32$0 | 0)) {
                          break label$45
                         }
                         if (!($14_1 & 8 | 0)) {
                          break label$45
                         }
                         $16_1 = ($1_1 >>> 4 | 0) + 1041 | 0;
                         $17_1 = 2;
                         break label$45;
                        }
                        $17_1 = 0;
                        $16_1 = 1041;
                        i64toi32_i32$2 = $7_1;
                        i64toi32_i32$0 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                        i64toi32_i32$1 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                        $12_1 = $24(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, $9_1 | 0) | 0;
                        if (!($14_1 & 8 | 0)) {
                         break label$45
                        }
                        $1_1 = $9_1 - $12_1 | 0;
                        $20_1 = ($20_1 | 0) > ($1_1 | 0) ? $20_1 : $1_1 + 1 | 0;
                        break label$45;
                       }
                       label$62 : {
                        i64toi32_i32$2 = $7_1;
                        i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                        i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                        $24_1 = i64toi32_i32$1;
                        $24$hi = i64toi32_i32$0;
                        i64toi32_i32$2 = i64toi32_i32$1;
                        i64toi32_i32$1 = -1;
                        i64toi32_i32$3 = -1;
                        if ((i64toi32_i32$0 | 0) > (i64toi32_i32$1 | 0)) {
                         $32_1 = 1
                        } else {
                         if ((i64toi32_i32$0 | 0) >= (i64toi32_i32$1 | 0)) {
                          if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
                           $33_1 = 0
                          } else {
                           $33_1 = 1
                          }
                          $34_1 = $33_1;
                         } else {
                          $34_1 = 0
                         }
                         $32_1 = $34_1;
                        }
                        if ($32_1) {
                         break label$62
                        }
                        i64toi32_i32$2 = $24$hi;
                        i64toi32_i32$2 = 0;
                        i64toi32_i32$3 = 0;
                        i64toi32_i32$0 = $24$hi;
                        i64toi32_i32$1 = $24_1;
                        i64toi32_i32$5 = (i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0) + i64toi32_i32$0 | 0;
                        i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
                        $24_1 = i64toi32_i32$3 - i64toi32_i32$1 | 0;
                        $24$hi = i64toi32_i32$5;
                        i64toi32_i32$3 = $7_1;
                        HEAP32[($7_1 + 64 | 0) >> 2] = $24_1;
                        HEAP32[($7_1 + 68 | 0) >> 2] = i64toi32_i32$5;
                        $17_1 = 1;
                        $16_1 = 1041;
                        break label$46;
                       }
                       label$63 : {
                        if (!($14_1 & 2048 | 0)) {
                         break label$63
                        }
                        $17_1 = 1;
                        $16_1 = 1042;
                        break label$46;
                       }
                       $17_1 = $14_1 & 1 | 0;
                       $16_1 = $17_1 ? 1043 : 1041;
                      }
                      i64toi32_i32$5 = $24$hi;
                      $12_1 = $25($24_1 | 0, i64toi32_i32$5 | 0, $9_1 | 0) | 0;
                     }
                     label$64 : {
                      if (!$21_1) {
                       break label$64
                      }
                      if (($20_1 | 0) < (0 | 0)) {
                       break label$4
                      }
                     }
                     $14_1 = $21_1 ? $14_1 & -65537 | 0 : $14_1;
                     label$65 : {
                      i64toi32_i32$2 = $7_1;
                      i64toi32_i32$5 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                      i64toi32_i32$3 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                      $24_1 = i64toi32_i32$5;
                      $24$hi = i64toi32_i32$3;
                      i64toi32_i32$2 = i64toi32_i32$5;
                      i64toi32_i32$5 = 0;
                      i64toi32_i32$1 = 0;
                      if ((i64toi32_i32$2 | 0) != (i64toi32_i32$1 | 0) | (i64toi32_i32$3 | 0) != (i64toi32_i32$5 | 0) | 0) {
                       break label$65
                      }
                      if ($20_1) {
                       break label$65
                      }
                      $12_1 = $9_1;
                      $22_1 = $12_1;
                      $20_1 = 0;
                      break label$7;
                     }
                     i64toi32_i32$2 = $24$hi;
                     $1_1 = ($9_1 - $12_1 | 0) + !($24_1 | i64toi32_i32$2 | 0) | 0;
                     $20_1 = ($20_1 | 0) > ($1_1 | 0) ? $20_1 : $1_1;
                     break label$8;
                    }
                    $17_1 = 0;
                    $1_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                    $12_1 = $1_1 ? $1_1 : 1138;
                    $1_1 = $16($12_1 | 0, (($20_1 | 0) < (0 | 0) ? 2147483647 : $20_1) | 0) | 0;
                    $22_1 = $12_1 + $1_1 | 0;
                    label$66 : {
                     if (($20_1 | 0) <= (-1 | 0)) {
                      break label$66
                     }
                     $14_1 = $23_1;
                     $20_1 = $1_1;
                     break label$7;
                    }
                    $14_1 = $23_1;
                    $20_1 = $1_1;
                    if (HEAPU8[$22_1 >> 0] | 0) {
                     break label$4
                    }
                    break label$7;
                   }
                   label$67 : {
                    if (!$20_1) {
                     break label$67
                    }
                    $13_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                    break label$41;
                   }
                   $1_1 = 0;
                   $26($0_1 | 0, 32 | 0, $19_1 | 0, 0 | 0, $14_1 | 0);
                   break label$40;
                  }
                  HEAP32[($7_1 + 12 | 0) >> 2] = 0;
                  i64toi32_i32$1 = $7_1;
                  i64toi32_i32$2 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                  i64toi32_i32$3 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                  HEAP32[($7_1 + 8 | 0) >> 2] = i64toi32_i32$2;
                  HEAP32[($7_1 + 64 | 0) >> 2] = $7_1 + 8 | 0;
                  $20_1 = -1;
                  $13_1 = $7_1 + 8 | 0;
                 }
                 $1_1 = 0;
                 label$68 : {
                  label$69 : while (1) {
                   $15_1 = HEAP32[$13_1 >> 2] | 0;
                   if (!$15_1) {
                    break label$68
                   }
                   label$70 : {
                    $15_1 = $45($7_1 + 4 | 0 | 0, $15_1 | 0) | 0;
                    $12_1 = ($15_1 | 0) < (0 | 0);
                    if ($12_1) {
                     break label$70
                    }
                    if ($15_1 >>> 0 > ($20_1 - $1_1 | 0) >>> 0) {
                     break label$70
                    }
                    $13_1 = $13_1 + 4 | 0;
                    $1_1 = $15_1 + $1_1 | 0;
                    if ($20_1 >>> 0 > $1_1 >>> 0) {
                     continue label$69
                    }
                    break label$68;
                   }
                   break label$69;
                  };
                  if ($12_1) {
                   break label$2
                  }
                 }
                 $22_1 = 61;
                 if (($1_1 | 0) < (0 | 0)) {
                  break label$3
                 }
                 $26($0_1 | 0, 32 | 0, $19_1 | 0, $1_1 | 0, $14_1 | 0);
                 label$71 : {
                  if ($1_1) {
                   break label$71
                  }
                  $1_1 = 0;
                  break label$40;
                 }
                 $15_1 = 0;
                 $13_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                 label$72 : while (1) {
                  $12_1 = HEAP32[$13_1 >> 2] | 0;
                  if (!$12_1) {
                   break label$40
                  }
                  $12_1 = $45($7_1 + 4 | 0 | 0, $12_1 | 0) | 0;
                  $15_1 = $12_1 + $15_1 | 0;
                  if ($15_1 >>> 0 > $1_1 >>> 0) {
                   break label$40
                  }
                  $20($0_1 | 0, $7_1 + 4 | 0 | 0, $12_1 | 0);
                  $13_1 = $13_1 + 4 | 0;
                  if ($15_1 >>> 0 < $1_1 >>> 0) {
                   continue label$72
                  }
                  break label$72;
                 };
                }
                $26($0_1 | 0, 32 | 0, $19_1 | 0, $1_1 | 0, $14_1 ^ 8192 | 0 | 0);
                $1_1 = ($19_1 | 0) > ($1_1 | 0) ? $19_1 : $1_1;
                continue label$5;
               }
               label$73 : {
                if (!$21_1) {
                 break label$73
                }
                if (($20_1 | 0) < (0 | 0)) {
                 break label$4
                }
               }
               $22_1 = 61;
               $1_1 = FUNCTION_TABLE[$5_1 | 0]($0_1, +HEAPF64[($7_1 + 64 | 0) >> 3], $19_1, $20_1, $14_1, $1_1) | 0;
               if (($1_1 | 0) >= (0 | 0)) {
                continue label$5
               }
               break label$3;
              }
              i64toi32_i32$1 = $7_1;
              i64toi32_i32$3 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
              i64toi32_i32$2 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
              HEAP8[($7_1 + 55 | 0) >> 0] = i64toi32_i32$3;
              $20_1 = 1;
              $12_1 = $8_1;
              $22_1 = $9_1;
              $14_1 = $23_1;
              break label$7;
             }
             $14_1 = $1_1 + 1 | 0;
             HEAP32[($7_1 + 76 | 0) >> 2] = $14_1;
             $13_1 = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
             $1_1 = $14_1;
             continue label$11;
            };
           }
           if ($0_1) {
            break label$1
           }
           if (!$10_1) {
            break label$6
           }
           $1_1 = 1;
           label$74 : {
            label$75 : while (1) {
             $13_1 = HEAP32[($4_1 + ($1_1 << 2 | 0) | 0) >> 2] | 0;
             if (!$13_1) {
              break label$74
             }
             $22($3_1 + ($1_1 << 3 | 0) | 0 | 0, $13_1 | 0, $2_1 | 0, $6_1 | 0);
             $11_1 = 1;
             $1_1 = $1_1 + 1 | 0;
             if (($1_1 | 0) != (10 | 0)) {
              continue label$75
             }
             break label$1;
            };
           }
           $11_1 = 1;
           if ($1_1 >>> 0 >= 10 >>> 0) {
            break label$1
           }
           label$76 : while (1) {
            if (HEAP32[($4_1 + ($1_1 << 2 | 0) | 0) >> 2] | 0) {
             break label$9
            }
            $11_1 = 1;
            $1_1 = $1_1 + 1 | 0;
            if (($1_1 | 0) == (10 | 0)) {
             break label$1
            }
            continue label$76;
           };
          }
          $22_1 = 28;
          break label$3;
         }
         $22_1 = $9_1;
        }
        $18_1 = $22_1 - $12_1 | 0;
        $20_1 = ($20_1 | 0) < ($18_1 | 0) ? $18_1 : $20_1;
        if (($20_1 | 0) > (2147483647 - $17_1 | 0 | 0)) {
         break label$4
        }
        $22_1 = 61;
        $15_1 = $17_1 + $20_1 | 0;
        $1_1 = ($19_1 | 0) < ($15_1 | 0) ? $15_1 : $19_1;
        if (($1_1 | 0) > ($13_1 | 0)) {
         break label$3
        }
        $26($0_1 | 0, 32 | 0, $1_1 | 0, $15_1 | 0, $14_1 | 0);
        $20($0_1 | 0, $16_1 | 0, $17_1 | 0);
        $26($0_1 | 0, 48 | 0, $1_1 | 0, $15_1 | 0, $14_1 ^ 65536 | 0 | 0);
        $26($0_1 | 0, 48 | 0, $20_1 | 0, $18_1 | 0, 0 | 0);
        $20($0_1 | 0, $12_1 | 0, $18_1 | 0);
        $26($0_1 | 0, 32 | 0, $1_1 | 0, $15_1 | 0, $14_1 ^ 8192 | 0 | 0);
        continue label$5;
       }
       break label$5;
      };
      $11_1 = 0;
      break label$1;
     }
     $22_1 = 61;
    }
    HEAP32[($13() | 0) >> 2] = $22_1;
   }
   $11_1 = -1;
  }
  global$0 = $7_1 + 80 | 0;
  return $11_1 | 0;
 }
 
 function $20($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  label$1 : {
   if ((HEAPU8[$0_1 >> 0] | 0) & 32 | 0) {
    break label$1
   }
   $61($1_1 | 0, $2_1 | 0, $0_1 | 0) | 0;
  }
 }
 
 function $21($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $2_1 = 0;
  $1_1 = 0;
  label$1 : {
   if ($14(HEAP8[(HEAP32[$0_1 >> 2] | 0) >> 0] | 0 | 0) | 0) {
    break label$1
   }
   return 0 | 0;
  }
  label$2 : while (1) {
   $2_1 = HEAP32[$0_1 >> 2] | 0;
   $3_1 = -1;
   label$3 : {
    if ($1_1 >>> 0 > 214748364 >>> 0) {
     break label$3
    }
    $3_1 = (HEAP8[$2_1 >> 0] | 0) + -48 | 0;
    $1_1 = Math_imul($1_1, 10);
    $3_1 = ($3_1 | 0) > (2147483647 - $1_1 | 0 | 0) ? -1 : $3_1 + $1_1 | 0;
   }
   HEAP32[$0_1 >> 2] = $2_1 + 1 | 0;
   $1_1 = $3_1;
   if ($14(HEAP8[($2_1 + 1 | 0) >> 0] | 0 | 0) | 0) {
    continue label$2
   }
   break label$2;
  };
  return $3_1 | 0;
 }
 
 function $22($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $21_1 = 0, $29_1 = 0, $37_1 = 0, $45_1 = 0, $55_1 = 0, $63_1 = 0, $71_1 = 0, $79 = 0, $87 = 0, $97 = 0, $105 = 0, $115 = 0, $125 = 0, $133 = 0, $141 = 0;
  label$1 : {
   switch ($1_1 + -9 | 0 | 0) {
   case 0:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    HEAP32[$0_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
    return;
   case 1:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
    $21_1 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $21_1;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 2:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$0 = 0;
    $29_1 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $29_1;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 4:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
    $37_1 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $37_1;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 5:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$0 = 0;
    $45_1 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $45_1;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 3:
    $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    $55_1 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $55_1;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 6:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$1 = HEAP16[$1_1 >> 1] | 0;
    i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
    $63_1 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $63_1;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 7:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAPU16[$1_1 >> 1] | 0;
    i64toi32_i32$1 = 0;
    $71_1 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $71_1;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 8:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$1 = HEAP8[$1_1 >> 0] | 0;
    i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
    $79 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $79;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 9:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAPU8[$1_1 >> 0] | 0;
    i64toi32_i32$1 = 0;
    $87 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $87;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 10:
    $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
    i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$0 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    $97 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $97;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 11:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = 0;
    $105 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $105;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 12:
    $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
    i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$0 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    $115 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $115;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 13:
    $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    $125 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $125;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 14:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
    $133 = i64toi32_i32$1;
    i64toi32_i32$1 = $0_1;
    HEAP32[i64toi32_i32$1 >> 2] = $133;
    HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
    return;
   case 15:
    $1_1 = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
    i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
    i64toi32_i32$1 = 0;
    $141 = i64toi32_i32$0;
    i64toi32_i32$0 = $0_1;
    HEAP32[i64toi32_i32$0 >> 2] = $141;
    HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
    return;
   case 16:
    $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
    HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
    HEAPF64[$0_1 >> 3] = +HEAPF64[$1_1 >> 3];
    return;
   case 17:
    FUNCTION_TABLE[$3_1 | 0]($0_1, $2_1);
    break;
   default:
    break label$1;
   };
  }
 }
 
 function $23($0_1, $0$hi, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $10_1 = 0, $3_1 = 0;
  label$1 : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    HEAP8[$1_1 >> 0] = HEAPU8[(($0_1 & 15 | 0) + 1616 | 0) >> 0] | 0 | $2_1 | 0;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 15;
    $3_1 = i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$1 = 4;
    i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $10_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
     $10_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $10_1;
    $0$hi = i64toi32_i32$0;
    if ($3_1) {
     continue label$2
    }
    break label$2;
   };
  }
  return $1_1 | 0;
 }
 
 function $24($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $9_1 = 0, $2_1 = 0;
  label$1 : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    HEAP8[$1_1 >> 0] = $0_1 & 7 | 0 | 48 | 0;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 7;
    $2_1 = i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$1 = 3;
    i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $9_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
     $9_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $9_1;
    $0$hi = i64toi32_i32$0;
    if ($2_1) {
     continue label$2
    }
    break label$2;
   };
  }
  return $1_1 | 0;
 }
 
 function $25($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $3_1 = 0, i64toi32_i32$3 = 0, $2_1 = 0, i64toi32_i32$5 = 0, $2$hi = 0, $4_1 = 0, $16_1 = 0, $16$hi = 0, $5_1 = 0;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 1;
    i64toi32_i32$3 = 0;
    if (i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
     break label$2
    }
    i64toi32_i32$2 = $0$hi;
    $2_1 = $0_1;
    $2$hi = i64toi32_i32$2;
    break label$1;
   }
   label$3 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_udiv($0_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $2_1 = i64toi32_i32$0;
    $2$hi = i64toi32_i32$2;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_mul($2_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $16_1 = i64toi32_i32$0;
    $16$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = $16$hi;
    i64toi32_i32$1 = $16_1;
    i64toi32_i32$5 = ($0_1 >>> 0 < i64toi32_i32$1 >>> 0) + i64toi32_i32$0 | 0;
    i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
    HEAP8[$1_1 >> 0] = $0_1 - i64toi32_i32$1 | 0 | 48 | 0;
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$3 = 9;
    i64toi32_i32$1 = -1;
    $3_1 = $0$hi >>> 0 > i64toi32_i32$3 >>> 0 | (($0$hi | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$1 >>> 0 | 0) | 0;
    i64toi32_i32$2 = $2$hi;
    $0_1 = $2_1;
    $0$hi = i64toi32_i32$2;
    if ($3_1) {
     continue label$3
    }
    break label$3;
   };
  }
  label$4 : {
   i64toi32_i32$2 = $2$hi;
   $3_1 = $2_1;
   if (!$3_1) {
    break label$4
   }
   label$5 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    $4_1 = ($3_1 >>> 0) / (10 >>> 0) | 0;
    HEAP8[$1_1 >> 0] = $3_1 - Math_imul($4_1, 10) | 0 | 48 | 0;
    $5_1 = $3_1 >>> 0 > 9 >>> 0;
    $3_1 = $4_1;
    if ($5_1) {
     continue label$5
    }
    break label$5;
   };
  }
  return $1_1 | 0;
 }
 
 function $26($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 256 | 0;
  global$0 = $5_1;
  label$1 : {
   if ($4_1 & 73728 | 0) {
    break label$1
   }
   if (($2_1 | 0) <= ($3_1 | 0)) {
    break label$1
   }
   $2_1 = $2_1 - $3_1 | 0;
   $3_1 = $2_1 >>> 0 < 256 >>> 0;
   $60($5_1 | 0, $1_1 & 255 | 0 | 0, ($3_1 ? $2_1 : 256) | 0) | 0;
   label$2 : {
    if ($3_1) {
     break label$2
    }
    label$3 : while (1) {
     $20($0_1 | 0, $5_1 | 0, 256 | 0);
     $2_1 = $2_1 + -256 | 0;
     if ($2_1 >>> 0 > 255 >>> 0) {
      continue label$3
     }
     break label$3;
    };
   }
   $20($0_1 | 0, $5_1 | 0, $2_1 | 0);
  }
  global$0 = $5_1 + 256 | 0;
 }
 
 function $27($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return $18($0_1 | 0, $1_1 | 0, $2_1 | 0, 1 | 0, 2 | 0) | 0 | 0;
 }
 
 function $28($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = +$1_1;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $10_1 = 0, $11_1 = 0, $12_1 = 0, $18_1 = 0, $6_1 = 0, $21_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $15_1 = 0, i64toi32_i32$4 = 0, $22_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $23_1 = 0, $19_1 = 0, $17_1 = 0, $8_1 = 0, $26_1 = 0.0, $24_1 = 0, $13_1 = 0, $24$hi = 0, $14_1 = 0, $16_1 = 0, $9_1 = 0, $20_1 = 0, $7_1 = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $25$hi = 0, $48_1 = 0, $25_1 = 0, $168 = 0, $170$hi = 0, $172$hi = 0, $174 = 0, $174$hi = 0, $176$hi = 0, $180 = 0, $180$hi = 0, $390 = 0.0, $855 = 0;
  $6_1 = global$0 - 560 | 0;
  global$0 = $6_1;
  $7_1 = 0;
  HEAP32[($6_1 + 44 | 0) >> 2] = 0;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $30(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$0;
    $24$hi = i64toi32_i32$1;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$0 = -1;
    i64toi32_i32$3 = -1;
    if ((i64toi32_i32$1 | 0) > (i64toi32_i32$0 | 0)) {
     $45_1 = 1
    } else {
     if ((i64toi32_i32$1 | 0) >= (i64toi32_i32$0 | 0)) {
      if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
       $46_1 = 0
      } else {
       $46_1 = 1
      }
      $47_1 = $46_1;
     } else {
      $47_1 = 0
     }
     $45_1 = $47_1;
    }
    if ($45_1) {
     break label$2
    }
    $8_1 = 1;
    $9_1 = 1051;
    $1_1 = -$1_1;
    i64toi32_i32$2 = $30(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$2;
    $24$hi = i64toi32_i32$1;
    break label$1;
   }
   label$3 : {
    if (!($4_1 & 2048 | 0)) {
     break label$3
    }
    $8_1 = 1;
    $9_1 = 1054;
    break label$1;
   }
   $8_1 = $4_1 & 1 | 0;
   $9_1 = $8_1 ? 1057 : 1052;
   $7_1 = !$8_1;
  }
  label$4 : {
   label$5 : {
    i64toi32_i32$1 = $24$hi;
    i64toi32_i32$3 = $24_1;
    i64toi32_i32$2 = 2146435072;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
    i64toi32_i32$1 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
    i64toi32_i32$3 = 2146435072;
    i64toi32_i32$0 = 0;
    if ((i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) {
     break label$5
    }
    $10_1 = $8_1 + 3 | 0;
    $26($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 & -65537 | 0 | 0);
    $20($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $11_1 = $5_1 & 32 | 0;
    $20($0_1 | 0, ($1_1 != $1_1 ? ($11_1 ? 1070 : 1128) : $11_1 ? 1091 : 1132) | 0, 3 | 0);
    $26($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
    $12_1 = ($10_1 | 0) < ($2_1 | 0) ? $2_1 : $10_1;
    break label$4;
   }
   $13_1 = $6_1 + 16 | 0;
   label$6 : {
    label$7 : {
     label$8 : {
      label$9 : {
       $1_1 = +$17(+$1_1, $6_1 + 44 | 0 | 0);
       $1_1 = $1_1 + $1_1;
       if ($1_1 == 0.0) {
        break label$9
       }
       $10_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
       HEAP32[($6_1 + 44 | 0) >> 2] = $10_1 + -1 | 0;
       $14_1 = $5_1 | 32 | 0;
       if (($14_1 | 0) != (97 | 0)) {
        break label$8
       }
       break label$6;
      }
      $14_1 = $5_1 | 32 | 0;
      if (($14_1 | 0) == (97 | 0)) {
       break label$6
      }
      $15_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
      $16_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
      break label$7;
     }
     $16_1 = $10_1 + -29 | 0;
     HEAP32[($6_1 + 44 | 0) >> 2] = $16_1;
     $15_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
     $1_1 = $1_1 * 268435456.0;
    }
    $17_1 = ($16_1 | 0) < (0 | 0) ? $6_1 + 48 | 0 : $6_1 + 336 | 0;
    $11_1 = $17_1;
    label$10 : while (1) {
     label$11 : {
      label$12 : {
       if (!($1_1 < 4294967296.0 & $1_1 >= 0.0 | 0)) {
        break label$12
       }
       $10_1 = ~~$1_1 >>> 0;
       break label$11;
      }
      $10_1 = 0;
     }
     HEAP32[$11_1 >> 2] = $10_1;
     $11_1 = $11_1 + 4 | 0;
     $1_1 = ($1_1 - +($10_1 >>> 0)) * 1.0e9;
     if ($1_1 != 0.0) {
      continue label$10
     }
     break label$10;
    };
    label$13 : {
     label$14 : {
      if (($16_1 | 0) >= (1 | 0)) {
       break label$14
      }
      $3_1 = $16_1;
      $10_1 = $11_1;
      $18_1 = $17_1;
      break label$13;
     }
     $18_1 = $17_1;
     $3_1 = $16_1;
     label$15 : while (1) {
      $3_1 = $3_1 >>> 0 < 29 >>> 0 ? $3_1 : 29;
      label$16 : {
       $10_1 = $11_1 + -4 | 0;
       if ($10_1 >>> 0 < $18_1 >>> 0) {
        break label$16
       }
       i64toi32_i32$1 = 0;
       $25_1 = $3_1;
       $25$hi = i64toi32_i32$1;
       i64toi32_i32$1 = 0;
       $24_1 = 0;
       $24$hi = i64toi32_i32$1;
       label$17 : while (1) {
        $168 = $10_1;
        i64toi32_i32$0 = $10_1;
        i64toi32_i32$1 = HEAP32[$10_1 >> 2] | 0;
        i64toi32_i32$2 = 0;
        $170$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $25$hi;
        i64toi32_i32$2 = $170$hi;
        i64toi32_i32$0 = i64toi32_i32$1;
        i64toi32_i32$1 = $25$hi;
        i64toi32_i32$3 = $25_1;
        i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
         $48_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
         $48_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
        }
        $172$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $24$hi;
        i64toi32_i32$2 = $24_1;
        i64toi32_i32$0 = 0;
        i64toi32_i32$3 = -1;
        i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
        $174 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
        $174$hi = i64toi32_i32$0;
        i64toi32_i32$0 = $172$hi;
        i64toi32_i32$1 = $48_1;
        i64toi32_i32$2 = $174$hi;
        i64toi32_i32$3 = $174;
        i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
        i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
        if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
        }
        $24_1 = i64toi32_i32$4;
        $24$hi = i64toi32_i32$5;
        $176$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_udiv(i64toi32_i32$4 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $24_1 = i64toi32_i32$1;
        $24$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_mul($24_1 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $180 = i64toi32_i32$1;
        $180$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $176$hi;
        i64toi32_i32$0 = i64toi32_i32$4;
        i64toi32_i32$1 = $180$hi;
        i64toi32_i32$3 = $180;
        i64toi32_i32$2 = i64toi32_i32$0 - i64toi32_i32$3 | 0;
        i64toi32_i32$4 = (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$1 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
        HEAP32[$168 >> 2] = i64toi32_i32$2;
        $10_1 = $10_1 + -4 | 0;
        if ($10_1 >>> 0 >= $18_1 >>> 0) {
         continue label$17
        }
        break label$17;
       };
       i64toi32_i32$4 = $24$hi;
       $10_1 = $24_1;
       if (!$10_1) {
        break label$16
       }
       $18_1 = $18_1 + -4 | 0;
       HEAP32[$18_1 >> 2] = $10_1;
      }
      label$18 : {
       label$19 : while (1) {
        $10_1 = $11_1;
        if ($10_1 >>> 0 <= $18_1 >>> 0) {
         break label$18
        }
        $11_1 = $10_1 + -4 | 0;
        if (!(HEAP32[$11_1 >> 2] | 0)) {
         continue label$19
        }
        break label$19;
       };
      }
      $3_1 = (HEAP32[($6_1 + 44 | 0) >> 2] | 0) - $3_1 | 0;
      HEAP32[($6_1 + 44 | 0) >> 2] = $3_1;
      $11_1 = $10_1;
      if (($3_1 | 0) > (0 | 0)) {
       continue label$15
      }
      break label$15;
     };
    }
    $11_1 = (($15_1 + 25 | 0) >>> 0) / (9 >>> 0) | 0;
    label$20 : {
     if (($3_1 | 0) > (-1 | 0)) {
      break label$20
     }
     $19_1 = $11_1 + 1 | 0;
     $20_1 = ($14_1 | 0) == (102 | 0);
     label$21 : while (1) {
      $11_1 = 0 - $3_1 | 0;
      $21_1 = $11_1 >>> 0 < 9 >>> 0 ? $11_1 : 9;
      label$22 : {
       label$23 : {
        if ($18_1 >>> 0 >= $10_1 >>> 0) {
         break label$23
        }
        $22_1 = 1e9 >>> $21_1 | 0;
        $23_1 = (-1 << $21_1 | 0) ^ -1 | 0;
        $3_1 = 0;
        $11_1 = $18_1;
        label$24 : while (1) {
         $12_1 = HEAP32[$11_1 >> 2] | 0;
         HEAP32[$11_1 >> 2] = ($12_1 >>> $21_1 | 0) + $3_1 | 0;
         $3_1 = Math_imul($12_1 & $23_1 | 0, $22_1);
         $11_1 = $11_1 + 4 | 0;
         if ($11_1 >>> 0 < $10_1 >>> 0) {
          continue label$24
         }
         break label$24;
        };
        $11_1 = HEAP32[$18_1 >> 2] | 0;
        if (!$3_1) {
         break label$22
        }
        HEAP32[$10_1 >> 2] = $3_1;
        $10_1 = $10_1 + 4 | 0;
        break label$22;
       }
       $11_1 = HEAP32[$18_1 >> 2] | 0;
      }
      $3_1 = (HEAP32[($6_1 + 44 | 0) >> 2] | 0) + $21_1 | 0;
      HEAP32[($6_1 + 44 | 0) >> 2] = $3_1;
      $18_1 = $18_1 + (!$11_1 << 2 | 0) | 0;
      $11_1 = $20_1 ? $17_1 : $18_1;
      $10_1 = (($10_1 - $11_1 | 0) >> 2 | 0 | 0) > ($19_1 | 0) ? $11_1 + ($19_1 << 2 | 0) | 0 : $10_1;
      if (($3_1 | 0) < (0 | 0)) {
       continue label$21
      }
      break label$21;
     };
    }
    $3_1 = 0;
    label$25 : {
     if ($18_1 >>> 0 >= $10_1 >>> 0) {
      break label$25
     }
     $3_1 = Math_imul(($17_1 - $18_1 | 0) >> 2 | 0, 9);
     $11_1 = 10;
     $12_1 = HEAP32[$18_1 >> 2] | 0;
     if ($12_1 >>> 0 < 10 >>> 0) {
      break label$25
     }
     label$26 : while (1) {
      $3_1 = $3_1 + 1 | 0;
      $11_1 = Math_imul($11_1, 10);
      if ($12_1 >>> 0 >= $11_1 >>> 0) {
       continue label$26
      }
      break label$26;
     };
    }
    label$27 : {
     $11_1 = ($15_1 - (($14_1 | 0) == (102 | 0) ? 0 : $3_1) | 0) - (($14_1 | 0) == (103 | 0) & ($15_1 | 0) != (0 | 0) | 0) | 0;
     if (($11_1 | 0) >= (Math_imul(($10_1 - $17_1 | 0) >> 2 | 0, 9) + -9 | 0 | 0)) {
      break label$27
     }
     $12_1 = $11_1 + 9216 | 0;
     $22_1 = ($12_1 | 0) / (9 | 0) | 0;
     $21_1 = (($22_1 << 2 | 0) + (($6_1 + 48 | 0) + (($16_1 | 0) < (0 | 0) ? 4 : 292) | 0) | 0) + -4096 | 0;
     $11_1 = 10;
     label$28 : {
      $12_1 = $12_1 - Math_imul($22_1, 9) | 0;
      if (($12_1 | 0) > (7 | 0)) {
       break label$28
      }
      label$29 : while (1) {
       $11_1 = Math_imul($11_1, 10);
       $12_1 = $12_1 + 1 | 0;
       if (($12_1 | 0) != (8 | 0)) {
        continue label$29
       }
       break label$29;
      };
     }
     $23_1 = $21_1 + 4 | 0;
     label$30 : {
      label$31 : {
       $12_1 = HEAP32[$21_1 >> 2] | 0;
       $19_1 = ($12_1 >>> 0) / ($11_1 >>> 0) | 0;
       $22_1 = $12_1 - Math_imul($19_1, $11_1) | 0;
       if ($22_1) {
        break label$31
       }
       if (($23_1 | 0) == ($10_1 | 0)) {
        break label$30
       }
      }
      label$32 : {
       label$33 : {
        if ($19_1 & 1 | 0) {
         break label$33
        }
        $1_1 = 9007199254740992.0;
        if (($11_1 | 0) != (1e9 | 0)) {
         break label$32
        }
        if ($21_1 >>> 0 <= $18_1 >>> 0) {
         break label$32
        }
        if (!((HEAPU8[($21_1 + -4 | 0) >> 0] | 0) & 1 | 0)) {
         break label$32
        }
       }
       $1_1 = 9007199254740994.0;
      }
      $390 = ($23_1 | 0) == ($10_1 | 0) ? 1.0 : 1.5;
      $23_1 = $11_1 >>> 1 | 0;
      $26_1 = $22_1 >>> 0 < $23_1 >>> 0 ? .5 : ($22_1 | 0) == ($23_1 | 0) ? $390 : 1.5;
      label$34 : {
       if ($7_1) {
        break label$34
       }
       if ((HEAPU8[$9_1 >> 0] | 0 | 0) != (45 | 0)) {
        break label$34
       }
       $26_1 = -$26_1;
       $1_1 = -$1_1;
      }
      $12_1 = $12_1 - $22_1 | 0;
      HEAP32[$21_1 >> 2] = $12_1;
      if ($1_1 + $26_1 == $1_1) {
       break label$30
      }
      $11_1 = $12_1 + $11_1 | 0;
      HEAP32[$21_1 >> 2] = $11_1;
      label$35 : {
       if ($11_1 >>> 0 < 1e9 >>> 0) {
        break label$35
       }
       label$36 : while (1) {
        HEAP32[$21_1 >> 2] = 0;
        label$37 : {
         $21_1 = $21_1 + -4 | 0;
         if ($21_1 >>> 0 >= $18_1 >>> 0) {
          break label$37
         }
         $18_1 = $18_1 + -4 | 0;
         HEAP32[$18_1 >> 2] = 0;
        }
        $11_1 = (HEAP32[$21_1 >> 2] | 0) + 1 | 0;
        HEAP32[$21_1 >> 2] = $11_1;
        if ($11_1 >>> 0 > 999999999 >>> 0) {
         continue label$36
        }
        break label$36;
       };
      }
      $3_1 = Math_imul(($17_1 - $18_1 | 0) >> 2 | 0, 9);
      $11_1 = 10;
      $12_1 = HEAP32[$18_1 >> 2] | 0;
      if ($12_1 >>> 0 < 10 >>> 0) {
       break label$30
      }
      label$38 : while (1) {
       $3_1 = $3_1 + 1 | 0;
       $11_1 = Math_imul($11_1, 10);
       if ($12_1 >>> 0 >= $11_1 >>> 0) {
        continue label$38
       }
       break label$38;
      };
     }
     $11_1 = $21_1 + 4 | 0;
     $10_1 = $10_1 >>> 0 > $11_1 >>> 0 ? $11_1 : $10_1;
    }
    label$39 : {
     label$40 : while (1) {
      $11_1 = $10_1;
      $12_1 = $10_1 >>> 0 <= $18_1 >>> 0;
      if ($12_1) {
       break label$39
      }
      $10_1 = $11_1 + -4 | 0;
      if (!(HEAP32[$10_1 >> 2] | 0)) {
       continue label$40
      }
      break label$40;
     };
    }
    label$41 : {
     label$42 : {
      if (($14_1 | 0) == (103 | 0)) {
       break label$42
      }
      $21_1 = $4_1 & 8 | 0;
      break label$41;
     }
     $10_1 = $15_1 ? $15_1 : 1;
     $21_1 = ($10_1 | 0) > ($3_1 | 0) & ($3_1 | 0) > (-5 | 0) | 0;
     $15_1 = ($21_1 ? $3_1 ^ -1 | 0 : -1) + $10_1 | 0;
     $5_1 = ($21_1 ? -1 : -2) + $5_1 | 0;
     $21_1 = $4_1 & 8 | 0;
     if ($21_1) {
      break label$41
     }
     $10_1 = -9;
     label$43 : {
      if ($12_1) {
       break label$43
      }
      $21_1 = HEAP32[($11_1 + -4 | 0) >> 2] | 0;
      if (!$21_1) {
       break label$43
      }
      $12_1 = 10;
      $10_1 = 0;
      if (($21_1 >>> 0) % (10 >>> 0) | 0) {
       break label$43
      }
      label$44 : while (1) {
       $22_1 = $10_1;
       $10_1 = $10_1 + 1 | 0;
       $12_1 = Math_imul($12_1, 10);
       if (!(($21_1 >>> 0) % ($12_1 >>> 0) | 0)) {
        continue label$44
       }
       break label$44;
      };
      $10_1 = $22_1 ^ -1 | 0;
     }
     $12_1 = Math_imul(($11_1 - $17_1 | 0) >> 2 | 0, 9);
     label$45 : {
      if (($5_1 & -33 | 0 | 0) != (70 | 0)) {
       break label$45
      }
      $21_1 = 0;
      $10_1 = ($12_1 + $10_1 | 0) + -9 | 0;
      $10_1 = ($10_1 | 0) > (0 | 0) ? $10_1 : 0;
      $15_1 = ($15_1 | 0) < ($10_1 | 0) ? $15_1 : $10_1;
      break label$41;
     }
     $21_1 = 0;
     $10_1 = (($3_1 + $12_1 | 0) + $10_1 | 0) + -9 | 0;
     $10_1 = ($10_1 | 0) > (0 | 0) ? $10_1 : 0;
     $15_1 = ($15_1 | 0) < ($10_1 | 0) ? $15_1 : $10_1;
    }
    $12_1 = -1;
    $10_1 = $15_1 | $21_1 | 0;
    if (($15_1 | 0) > (($10_1 ? 2147483645 : 2147483646) | 0)) {
     break label$4
    }
    $20_1 = ($10_1 | 0) != (0 | 0);
    $22_1 = ($15_1 + $20_1 | 0) + 1 | 0;
    label$46 : {
     label$47 : {
      $19_1 = $5_1 & -33 | 0;
      if (($19_1 | 0) != (70 | 0)) {
       break label$47
      }
      if (($3_1 | 0) > (2147483647 - $22_1 | 0 | 0)) {
       break label$4
      }
      $10_1 = ($3_1 | 0) > (0 | 0) ? $3_1 : 0;
      break label$46;
     }
     label$48 : {
      $10_1 = $3_1 >> 31 | 0;
      i64toi32_i32$4 = 0;
      $10_1 = $25(($3_1 + $10_1 | 0) ^ $10_1 | 0 | 0, i64toi32_i32$4 | 0, $13_1 | 0) | 0;
      if (($13_1 - $10_1 | 0 | 0) > (1 | 0)) {
       break label$48
      }
      label$49 : while (1) {
       $10_1 = $10_1 + -1 | 0;
       HEAP8[$10_1 >> 0] = 48;
       if (($13_1 - $10_1 | 0 | 0) < (2 | 0)) {
        continue label$49
       }
       break label$49;
      };
     }
     $23_1 = $10_1 + -2 | 0;
     HEAP8[$23_1 >> 0] = $5_1;
     $12_1 = -1;
     HEAP8[($10_1 + -1 | 0) >> 0] = ($3_1 | 0) < (0 | 0) ? 45 : 43;
     $10_1 = $13_1 - $23_1 | 0;
     if (($10_1 | 0) > (2147483647 - $22_1 | 0 | 0)) {
      break label$4
     }
    }
    $12_1 = -1;
    $10_1 = $10_1 + $22_1 | 0;
    if (($10_1 | 0) > ($8_1 ^ 2147483647 | 0 | 0)) {
     break label$4
    }
    $5_1 = $10_1 + $8_1 | 0;
    $26($0_1 | 0, 32 | 0, $2_1 | 0, $5_1 | 0, $4_1 | 0);
    $20($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $26($0_1 | 0, 48 | 0, $2_1 | 0, $5_1 | 0, $4_1 ^ 65536 | 0 | 0);
    label$50 : {
     label$51 : {
      label$52 : {
       label$53 : {
        if (($19_1 | 0) != (70 | 0)) {
         break label$53
        }
        $21_1 = $6_1 + 16 | 0 | 8 | 0;
        $3_1 = $6_1 + 16 | 0 | 9 | 0;
        $12_1 = $18_1 >>> 0 > $17_1 >>> 0 ? $17_1 : $18_1;
        $18_1 = $12_1;
        label$54 : while (1) {
         i64toi32_i32$5 = $18_1;
         i64toi32_i32$4 = HEAP32[$18_1 >> 2] | 0;
         i64toi32_i32$0 = 0;
         $10_1 = $25(i64toi32_i32$4 | 0, i64toi32_i32$0 | 0, $3_1 | 0) | 0;
         label$55 : {
          label$56 : {
           if (($18_1 | 0) == ($12_1 | 0)) {
            break label$56
           }
           if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break label$55
           }
           label$57 : while (1) {
            $10_1 = $10_1 + -1 | 0;
            HEAP8[$10_1 >> 0] = 48;
            if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label$57
            }
            break label$55;
           };
          }
          if (($10_1 | 0) != ($3_1 | 0)) {
           break label$55
          }
          HEAP8[($6_1 + 24 | 0) >> 0] = 48;
          $10_1 = $21_1;
         }
         $20($0_1 | 0, $10_1 | 0, $3_1 - $10_1 | 0 | 0);
         $18_1 = $18_1 + 4 | 0;
         if ($18_1 >>> 0 <= $17_1 >>> 0) {
          continue label$54
         }
         break label$54;
        };
        $10_1 = 0;
        if (!$20_1) {
         break label$51
        }
        $20($0_1 | 0, 1136 | 0, 1 | 0);
        if ($18_1 >>> 0 >= $11_1 >>> 0) {
         break label$52
        }
        if (($15_1 | 0) < (1 | 0)) {
         break label$52
        }
        label$58 : while (1) {
         label$59 : {
          i64toi32_i32$5 = $18_1;
          i64toi32_i32$0 = HEAP32[$18_1 >> 2] | 0;
          i64toi32_i32$4 = 0;
          $10_1 = $25(i64toi32_i32$0 | 0, i64toi32_i32$4 | 0, $3_1 | 0) | 0;
          if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
           break label$59
          }
          label$60 : while (1) {
           $10_1 = $10_1 + -1 | 0;
           HEAP8[$10_1 >> 0] = 48;
           if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
            continue label$60
           }
           break label$60;
          };
         }
         $20($0_1 | 0, $10_1 | 0, (($15_1 | 0) < (9 | 0) ? $15_1 : 9) | 0);
         $10_1 = $15_1 + -9 | 0;
         $18_1 = $18_1 + 4 | 0;
         if ($18_1 >>> 0 >= $11_1 >>> 0) {
          break label$51
         }
         $12_1 = ($15_1 | 0) > (9 | 0);
         $15_1 = $10_1;
         if ($12_1) {
          continue label$58
         }
         break label$51;
        };
       }
       label$61 : {
        if (($15_1 | 0) < (0 | 0)) {
         break label$61
        }
        $22_1 = $11_1 >>> 0 > $18_1 >>> 0 ? $11_1 : $18_1 + 4 | 0;
        $3_1 = $6_1 + 16 | 0 | 9 | 0;
        $19_1 = $6_1 + 16 | 0 | 8 | 0;
        $11_1 = $18_1;
        label$62 : while (1) {
         label$63 : {
          i64toi32_i32$5 = $11_1;
          i64toi32_i32$4 = HEAP32[$11_1 >> 2] | 0;
          i64toi32_i32$0 = 0;
          $10_1 = $25(i64toi32_i32$4 | 0, i64toi32_i32$0 | 0, $3_1 | 0) | 0;
          if (($10_1 | 0) != ($3_1 | 0)) {
           break label$63
          }
          HEAP8[($6_1 + 24 | 0) >> 0] = 48;
          $10_1 = $19_1;
         }
         label$64 : {
          label$65 : {
           if (($11_1 | 0) == ($18_1 | 0)) {
            break label$65
           }
           if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break label$64
           }
           label$66 : while (1) {
            $10_1 = $10_1 + -1 | 0;
            HEAP8[$10_1 >> 0] = 48;
            if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label$66
            }
            break label$64;
           };
          }
          $20($0_1 | 0, $10_1 | 0, 1 | 0);
          $10_1 = $10_1 + 1 | 0;
          if (!($15_1 | $21_1 | 0)) {
           break label$64
          }
          $20($0_1 | 0, 1136 | 0, 1 | 0);
         }
         $12_1 = $3_1 - $10_1 | 0;
         $20($0_1 | 0, $10_1 | 0, (($15_1 | 0) > ($12_1 | 0) ? $12_1 : $15_1) | 0);
         $15_1 = $15_1 - $12_1 | 0;
         $11_1 = $11_1 + 4 | 0;
         if ($11_1 >>> 0 >= $22_1 >>> 0) {
          break label$61
         }
         if (($15_1 | 0) > (-1 | 0)) {
          continue label$62
         }
         break label$62;
        };
       }
       $26($0_1 | 0, 48 | 0, $15_1 + 18 | 0 | 0, 18 | 0, 0 | 0);
       $20($0_1 | 0, $23_1 | 0, $13_1 - $23_1 | 0 | 0);
       break label$50;
      }
      $10_1 = $15_1;
     }
     $26($0_1 | 0, 48 | 0, $10_1 + 9 | 0 | 0, 9 | 0, 0 | 0);
    }
    $26($0_1 | 0, 32 | 0, $2_1 | 0, $5_1 | 0, $4_1 ^ 8192 | 0 | 0);
    $12_1 = ($5_1 | 0) < ($2_1 | 0) ? $2_1 : $5_1;
    break label$4;
   }
   $23_1 = $9_1 + ((($5_1 << 26 | 0) >> 31 | 0) & 9 | 0) | 0;
   label$67 : {
    if ($3_1 >>> 0 > 11 >>> 0) {
     break label$67
    }
    $10_1 = 12 - $3_1 | 0;
    $26_1 = 16.0;
    label$68 : while (1) {
     $26_1 = $26_1 * 16.0;
     $10_1 = $10_1 + -1 | 0;
     if ($10_1) {
      continue label$68
     }
     break label$68;
    };
    label$69 : {
     if ((HEAPU8[$23_1 >> 0] | 0 | 0) != (45 | 0)) {
      break label$69
     }
     $1_1 = -($26_1 + (-$1_1 - $26_1));
     break label$67;
    }
    $1_1 = $1_1 + $26_1 - $26_1;
   }
   label$70 : {
    $10_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
    $855 = $10_1;
    $10_1 = $10_1 >> 31 | 0;
    i64toi32_i32$0 = 0;
    $10_1 = $25(($855 + $10_1 | 0) ^ $10_1 | 0 | 0, i64toi32_i32$0 | 0, $13_1 | 0) | 0;
    if (($10_1 | 0) != ($13_1 | 0)) {
     break label$70
    }
    HEAP8[($6_1 + 15 | 0) >> 0] = 48;
    $10_1 = $6_1 + 15 | 0;
   }
   $21_1 = $8_1 | 2 | 0;
   $18_1 = $5_1 & 32 | 0;
   $11_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
   $22_1 = $10_1 + -2 | 0;
   HEAP8[$22_1 >> 0] = $5_1 + 15 | 0;
   HEAP8[($10_1 + -1 | 0) >> 0] = ($11_1 | 0) < (0 | 0) ? 45 : 43;
   $12_1 = $4_1 & 8 | 0;
   $11_1 = $6_1 + 16 | 0;
   label$71 : while (1) {
    $10_1 = $11_1;
    label$72 : {
     label$73 : {
      if (!(Math_abs($1_1) < 2147483648.0)) {
       break label$73
      }
      $11_1 = ~~$1_1;
      break label$72;
     }
     $11_1 = -2147483648;
    }
    HEAP8[$10_1 >> 0] = HEAPU8[($11_1 + 1616 | 0) >> 0] | 0 | $18_1 | 0;
    $1_1 = ($1_1 - +($11_1 | 0)) * 16.0;
    label$74 : {
     $11_1 = $10_1 + 1 | 0;
     if (($11_1 - ($6_1 + 16 | 0) | 0 | 0) != (1 | 0)) {
      break label$74
     }
     label$75 : {
      if ($1_1 != 0.0) {
       break label$75
      }
      if (($3_1 | 0) > (0 | 0)) {
       break label$75
      }
      if (!$12_1) {
       break label$74
      }
     }
     HEAP8[($10_1 + 1 | 0) >> 0] = 46;
     $11_1 = $10_1 + 2 | 0;
    }
    if ($1_1 != 0.0) {
     continue label$71
    }
    break label$71;
   };
   $12_1 = -1;
   $19_1 = $13_1 - $22_1 | 0;
   $10_1 = $21_1 + $19_1 | 0;
   if ((2147483645 - $10_1 | 0 | 0) < ($3_1 | 0)) {
    break label$4
   }
   label$76 : {
    label$77 : {
     if (!$3_1) {
      break label$77
     }
     $18_1 = $11_1 - ($6_1 + 16 | 0) | 0;
     if (($18_1 + -2 | 0 | 0) >= ($3_1 | 0)) {
      break label$77
     }
     $11_1 = $3_1 + 2 | 0;
     break label$76;
    }
    $18_1 = $11_1 - ($6_1 + 16 | 0) | 0;
    $11_1 = $18_1;
   }
   $10_1 = $10_1 + $11_1 | 0;
   $26($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 | 0);
   $20($0_1 | 0, $23_1 | 0, $21_1 | 0);
   $26($0_1 | 0, 48 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 65536 | 0 | 0);
   $20($0_1 | 0, $6_1 + 16 | 0 | 0, $18_1 | 0);
   $26($0_1 | 0, 48 | 0, $11_1 - $18_1 | 0 | 0, 0 | 0, 0 | 0);
   $20($0_1 | 0, $22_1 | 0, $19_1 | 0);
   $26($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
   $12_1 = ($10_1 | 0) < ($2_1 | 0) ? $2_1 : $10_1;
  }
  global$0 = $6_1 + 560 | 0;
  return $12_1 | 0;
 }
 
 function $29($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $2_1 = 0, $12_1 = 0, $12$hi = 0, $15_1 = 0, $15$hi = 0;
  $2_1 = ((HEAP32[$1_1 >> 2] | 0) + 7 | 0) & -8 | 0;
  HEAP32[$1_1 >> 2] = $2_1 + 16 | 0;
  i64toi32_i32$2 = $2_1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $12_1 = i64toi32_i32$0;
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$2 = i64toi32_i32$2 + 8 | 0;
  i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $15_1 = i64toi32_i32$1;
  $15$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $12$hi;
  i64toi32_i32$1 = $15$hi;
  HEAPF64[$0_1 >> 3] = +$48($12_1 | 0, i64toi32_i32$0 | 0, $15_1 | 0, i64toi32_i32$1 | 0);
 }
 
 function $30($0_1) {
  $0_1 = +$0_1;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  wasm2js_scratch_store_f64(+$0_1);
  i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
  i64toi32_i32$1 = wasm2js_scratch_load_i32(0 | 0) | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function $31($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $5_1 = 0;
  $4_1 = global$0 - 160 | 0;
  global$0 = $4_1;
  $5_1 = -1;
  HEAP32[($4_1 + 148 | 0) >> 2] = $1_1 ? $1_1 + -1 | 0 : 0;
  $0_1 = $1_1 ? $0_1 : $4_1 + 158 | 0;
  HEAP32[($4_1 + 144 | 0) >> 2] = $0_1;
  $4_1 = $60($4_1 | 0, 0 | 0, 144 | 0) | 0;
  HEAP32[($4_1 + 76 | 0) >> 2] = -1;
  HEAP32[($4_1 + 36 | 0) >> 2] = 3;
  HEAP32[($4_1 + 80 | 0) >> 2] = -1;
  HEAP32[($4_1 + 44 | 0) >> 2] = $4_1 + 159 | 0;
  HEAP32[($4_1 + 84 | 0) >> 2] = $4_1 + 144 | 0;
  label$1 : {
   label$2 : {
    if (($1_1 | 0) > (-1 | 0)) {
     break label$2
    }
    HEAP32[($13() | 0) >> 2] = 61;
    break label$1;
   }
   HEAP8[$0_1 >> 0] = 0;
   $5_1 = $27($4_1 | 0, $2_1 | 0, $3_1 | 0) | 0;
  }
  global$0 = $4_1 + 160 | 0;
  return $5_1 | 0;
 }
 
 function $32($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $4_1 = 0, $5_1 = 0;
  label$1 : {
   $3_1 = HEAP32[($0_1 + 84 | 0) >> 2] | 0;
   $4_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
   $5_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
   $6_1 = (HEAP32[($0_1 + 20 | 0) >> 2] | 0) - $5_1 | 0;
   $6_1 = $4_1 >>> 0 < $6_1 >>> 0 ? $4_1 : $6_1;
   if (!$6_1) {
    break label$1
   }
   $59(HEAP32[$3_1 >> 2] | 0 | 0, $5_1 | 0, $6_1 | 0) | 0;
   HEAP32[$3_1 >> 2] = (HEAP32[$3_1 >> 2] | 0) + $6_1 | 0;
   $4_1 = (HEAP32[($3_1 + 4 | 0) >> 2] | 0) - $6_1 | 0;
   HEAP32[($3_1 + 4 | 0) >> 2] = $4_1;
  }
  $6_1 = HEAP32[$3_1 >> 2] | 0;
  label$2 : {
   $4_1 = $4_1 >>> 0 < $2_1 >>> 0 ? $4_1 : $2_1;
   if (!$4_1) {
    break label$2
   }
   $59($6_1 | 0, $1_1 | 0, $4_1 | 0) | 0;
   $6_1 = (HEAP32[$3_1 >> 2] | 0) + $4_1 | 0;
   HEAP32[$3_1 >> 2] = $6_1;
   HEAP32[($3_1 + 4 | 0) >> 2] = (HEAP32[($3_1 + 4 | 0) >> 2] | 0) - $4_1 | 0;
  }
  HEAP8[$6_1 >> 0] = 0;
  $3_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
  HEAP32[($0_1 + 28 | 0) >> 2] = $3_1;
  HEAP32[($0_1 + 20 | 0) >> 2] = $3_1;
  return $2_1 | 0;
 }
 
 function $33($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return $31($0_1 | 0, 2147483647 | 0, $1_1 | 0, $2_1 | 0) | 0 | 0;
 }
 
 function $34($0_1) {
  $0_1 = $0_1 | 0;
  return $0_1 | 0;
 }
 
 function $35($0_1) {
  $0_1 = $0_1 | 0;
  return fimport$0($34(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0) | 0 | 0) | 0 | 0;
 }
 
 function $36($0_1) {
  $0_1 = $0_1 | 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return 0 | 0;
  }
  HEAP32[($13() | 0) >> 2] = $0_1;
  return -1 | 0;
 }
 
 function $37($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0, $8_1 = 0, $9_1 = 0, $6_1 = 0, $7_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  $4_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = $4_1;
  $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  $1_1 = $5_1 - $4_1 | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  $6_1 = $1_1 + $2_1 | 0;
  $7_1 = 2;
  $1_1 = $3_1 + 16 | 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      if ($36(fimport$1(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $3_1 + 16 | 0 | 0, 2 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0) {
       break label$4
      }
      label$5 : while (1) {
       $4_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($4_1 | 0)) {
        break label$3
       }
       if (($4_1 | 0) <= (-1 | 0)) {
        break label$2
       }
       $8_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
       $5_1 = $4_1 >>> 0 > $8_1 >>> 0;
       $9_1 = $1_1 + ($5_1 << 3 | 0) | 0;
       $8_1 = $4_1 - ($5_1 ? $8_1 : 0) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) + $8_1 | 0;
       $9_1 = $1_1 + ($5_1 ? 12 : 4) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) - $8_1 | 0;
       $6_1 = $6_1 - $4_1 | 0;
       $1_1 = $5_1 ? $1_1 + 8 | 0 : $1_1;
       $7_1 = $7_1 - $5_1 | 0;
       if (!($36(fimport$1(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $1_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        continue label$5
       }
       break label$5;
      };
     }
     if (($6_1 | 0) != (-1 | 0)) {
      break label$2
     }
    }
    $1_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 20 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 16 | 0) >> 2] = $1_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
    $4_1 = $2_1;
    break label$1;
   }
   $4_1 = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = 0;
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | 32 | 0;
   if (($7_1 | 0) == (2 | 0)) {
    break label$1
   }
   $4_1 = $2_1 - (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $38($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $3_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  i64toi32_i32$0 = $1$hi;
  $0_1 = $36($74($0_1 | 0, $1_1 | 0, i64toi32_i32$0 | 0, $2_1 & 255 | 0 | 0, $3_1 + 8 | 0 | 0) | 0 | 0) | 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
  $1_1 = i64toi32_i32$0;
  $1$hi = i64toi32_i32$1;
  global$0 = i64toi32_i32$2 + 16 | 0;
  i64toi32_i32$1 = -1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$3 = $0_1 ? -1 : $1_1;
  i64toi32_i32$2 = $0_1 ? i64toi32_i32$1 : i64toi32_i32$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$2;
  return i64toi32_i32$3 | 0;
 }
 
 function $39($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$0 = $38(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $1_1 | 0, i64toi32_i32$0 | 0, $2_1 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $40() {
  return 42 | 0;
 }
 
 function $41() {
  return $40() | 0 | 0;
 }
 
 function $42() {
  return 2020 | 0;
 }
 
 function $43() {
  HEAP32[(0 + 2108 | 0) >> 2] = 1988;
  HEAP32[(0 + 2036 | 0) >> 2] = $41() | 0;
 }
 
 function $44($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = 1;
  label$1 : {
   label$2 : {
    if (!$0_1) {
     break label$2
    }
    if ($1_1 >>> 0 <= 127 >>> 0) {
     break label$1
    }
    label$3 : {
     label$4 : {
      if (HEAP32[(HEAP32[(($42() | 0) + 88 | 0) >> 2] | 0) >> 2] | 0) {
       break label$4
      }
      if (($1_1 & -128 | 0 | 0) == (57216 | 0)) {
       break label$1
      }
      HEAP32[($13() | 0) >> 2] = 25;
      break label$3;
     }
     label$5 : {
      if ($1_1 >>> 0 > 2047 >>> 0) {
       break label$5
      }
      HEAP8[($0_1 + 1 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 6 | 0 | 192 | 0;
      return 2 | 0;
     }
     label$6 : {
      label$7 : {
       if ($1_1 >>> 0 < 55296 >>> 0) {
        break label$7
       }
       if (($1_1 & -8192 | 0 | 0) != (57344 | 0)) {
        break label$6
       }
      }
      HEAP8[($0_1 + 2 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 12 | 0 | 224 | 0;
      HEAP8[($0_1 + 1 | 0) >> 0] = ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0;
      return 3 | 0;
     }
     label$8 : {
      if (($1_1 + -65536 | 0) >>> 0 > 1048575 >>> 0) {
       break label$8
      }
      HEAP8[($0_1 + 3 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 18 | 0 | 240 | 0;
      HEAP8[($0_1 + 2 | 0) >> 0] = ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0;
      HEAP8[($0_1 + 1 | 0) >> 0] = ($1_1 >>> 12 | 0) & 63 | 0 | 128 | 0;
      return 4 | 0;
     }
     HEAP32[($13() | 0) >> 2] = 25;
    }
    $3_1 = -1;
   }
   return $3_1 | 0;
  }
  HEAP8[$0_1 >> 0] = $1_1;
  return 1 | 0;
 }
 
 function $45($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return 0 | 0;
  }
  return $44($0_1 | 0, $1_1 | 0, 0 | 0) | 0 | 0;
 }
 
 function $46($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  label$1 : {
   label$2 : {
    if (!($3_1 & 64 | 0)) {
     break label$2
    }
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $18_1 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $18_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $2_1 = $18_1;
    $2$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $1_1 = 0;
    $1$hi = i64toi32_i32$1;
    break label$1;
   }
   if (!$3_1) {
    break label$1
   }
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $20_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $20_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $21_1 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
    $21_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $2_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $2$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $22_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $22_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $1_1 = $22_1;
   $1$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $47($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  label$1 : {
   label$2 : {
    if (!($3_1 & 64 | 0)) {
     break label$2
    }
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$2 = $2_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $1_1 = $18_1;
    $1$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $2_1 = 0;
    $2$hi = i64toi32_i32$1;
    break label$1;
   }
   if (!$3_1) {
    break label$1
   }
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $20_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $20_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$1 = $1_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $21_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $1_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $1$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = $22_1;
   $2$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $48($0_1, $0$hi, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $4_1 = 0, $4$hi = 0, $5$hi = 0, $5_1 = 0, $2_1 = 0, $3_1 = 0, $43_1 = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, $49_1 = 0, $50_1 = 0, $12_1 = 0, $12$hi = 0, $14$hi = 0, $17_1 = 0, $17$hi = 0, $19$hi = 0, $34_1 = 0, $34$hi = 0, $37_1 = 0, $39_1 = 0, $44_1 = 0, $44$hi = 0, $46$hi = 0, $74_1 = 0, $74$hi = 0, $78$hi = 0, $81 = 0, $81$hi = 0, $83 = 0, $83$hi = 0, $87 = 0, $87$hi = 0, $89 = 0, $90$hi = 0, $100$hi = 0, $107 = 0, $107$hi = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = 2147483647;
    i64toi32_i32$3 = -1;
    i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
    $4_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
    $4$hi = i64toi32_i32$1;
    i64toi32_i32$0 = $4_1;
    i64toi32_i32$2 = -1006698496;
    i64toi32_i32$3 = 0;
    i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    $12_1 = i64toi32_i32$4;
    $12$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $4$hi;
    i64toi32_i32$1 = $4_1;
    i64toi32_i32$0 = -1140785152;
    i64toi32_i32$3 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $14$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $12$hi;
    i64toi32_i32$5 = $12_1;
    i64toi32_i32$1 = $14$hi;
    i64toi32_i32$3 = i64toi32_i32$2;
    if (i64toi32_i32$4 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$5 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
     break label$2
    }
    i64toi32_i32$5 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 60;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = 0;
     $43_1 = i64toi32_i32$5 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$4 = i64toi32_i32$5 >>> i64toi32_i32$0 | 0;
     $43_1 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$0 | 0) | 0;
    }
    $17_1 = $43_1;
    $17$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $1$hi;
    i64toi32_i32$5 = $1_1;
    i64toi32_i32$3 = 0;
    i64toi32_i32$1 = 4;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$3 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     $45_1 = 0;
    } else {
     i64toi32_i32$3 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$0 | 0) | 0;
     $45_1 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
    }
    $19$hi = i64toi32_i32$3;
    i64toi32_i32$3 = $17$hi;
    i64toi32_i32$4 = $17_1;
    i64toi32_i32$5 = $19$hi;
    i64toi32_i32$1 = $45_1;
    i64toi32_i32$5 = i64toi32_i32$3 | i64toi32_i32$5 | 0;
    $4_1 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    $4$hi = i64toi32_i32$5;
    label$3 : {
     i64toi32_i32$5 = $0$hi;
     i64toi32_i32$3 = $0_1;
     i64toi32_i32$4 = 268435455;
     i64toi32_i32$1 = -1;
     i64toi32_i32$4 = i64toi32_i32$5 & i64toi32_i32$4 | 0;
     $0_1 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
     $0$hi = i64toi32_i32$4;
     i64toi32_i32$5 = $0_1;
     i64toi32_i32$3 = 134217728;
     i64toi32_i32$1 = 1;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$5 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0) {
      break label$3
     }
     i64toi32_i32$5 = $4$hi;
     i64toi32_i32$1 = $4_1;
     i64toi32_i32$4 = 1073741824;
     i64toi32_i32$3 = 1;
     i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
     i64toi32_i32$2 = i64toi32_i32$5 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $5_1 = i64toi32_i32$0;
     $5$hi = i64toi32_i32$2;
     break label$1;
    }
    i64toi32_i32$2 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$1 = 1073741824;
    i64toi32_i32$3 = 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
    i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
    }
    $5_1 = i64toi32_i32$4;
    $5$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$5 = 134217728;
    i64toi32_i32$3 = 0;
    i64toi32_i32$5 = i64toi32_i32$0 ^ i64toi32_i32$5 | 0;
    i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$2 | 0) | 0) {
     break label$1
    }
    i64toi32_i32$0 = $5$hi;
    i64toi32_i32$0 = $4$hi;
    i64toi32_i32$3 = $4_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$2 = 1;
    i64toi32_i32$5 = i64toi32_i32$0 & i64toi32_i32$5 | 0;
    $34_1 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
    $34$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $5$hi;
    i64toi32_i32$0 = $5_1;
    i64toi32_i32$3 = $34$hi;
    i64toi32_i32$2 = $34_1;
    i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $5_1 = i64toi32_i32$1;
    $5$hi = i64toi32_i32$4;
    break label$1;
   }
   label$4 : {
    i64toi32_i32$4 = $0$hi;
    $37_1 = !($0_1 | i64toi32_i32$4 | 0);
    i64toi32_i32$4 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$0 = 2147418112;
    i64toi32_i32$2 = 0;
    $39_1 = i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$5 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
    i64toi32_i32$5 = i64toi32_i32$4;
    i64toi32_i32$2 = $4_1;
    i64toi32_i32$4 = 2147418112;
    i64toi32_i32$0 = 0;
    if ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & (i64toi32_i32$5 | 0) == (i64toi32_i32$4 | 0) | 0 ? $37_1 : $39_1) {
     break label$4
    }
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$4 = 60;
    i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
     i64toi32_i32$5 = 0;
     $46_1 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
    } else {
     i64toi32_i32$5 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
     $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$3 | 0) | 0;
    }
    $44_1 = $46_1;
    $44$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$4 = 4;
    i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
     $47_1 = 0;
    } else {
     i64toi32_i32$0 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
     $47_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
    }
    $46$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $44$hi;
    i64toi32_i32$5 = $44_1;
    i64toi32_i32$2 = $46$hi;
    i64toi32_i32$4 = $47_1;
    i64toi32_i32$2 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
    i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
    i64toi32_i32$5 = 524287;
    i64toi32_i32$4 = -1;
    i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
    i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
    i64toi32_i32$0 = 2146959360;
    i64toi32_i32$4 = 0;
    i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$0 | 0;
    $5_1 = i64toi32_i32$2 | i64toi32_i32$4 | 0;
    $5$hi = i64toi32_i32$0;
    break label$1;
   }
   i64toi32_i32$0 = 2146435072;
   $5_1 = 0;
   $5$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$5 = $4_1;
   i64toi32_i32$2 = 1140785151;
   i64toi32_i32$4 = -1;
   if (i64toi32_i32$0 >>> 0 > i64toi32_i32$2 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$5 >>> 0 > i64toi32_i32$4 >>> 0 | 0) | 0) {
    break label$1
   }
   i64toi32_i32$5 = 0;
   $5_1 = 0;
   $5$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $4$hi;
   i64toi32_i32$4 = $4_1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$2 = 48;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $48_1 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
    $48_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$3 | 0) | 0;
   }
   $3_1 = $48_1;
   if ($3_1 >>> 0 < 15249 >>> 0) {
    break label$1
   }
   i64toi32_i32$0 = $0$hi;
   i64toi32_i32$0 = $1$hi;
   i64toi32_i32$5 = $1_1;
   i64toi32_i32$4 = 65535;
   i64toi32_i32$2 = -1;
   i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
   i64toi32_i32$0 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
   i64toi32_i32$5 = 65536;
   i64toi32_i32$2 = 0;
   i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
   $4_1 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
   $4$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $0$hi;
   i64toi32_i32$0 = $4$hi;
   $46($2_1 + 16 | 0 | 0, $0_1 | 0, i64toi32_i32$5 | 0, $4_1 | 0, i64toi32_i32$0 | 0, $3_1 + -15233 | 0 | 0);
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$5 = $4$hi;
   $47($2_1 | 0, $0_1 | 0, i64toi32_i32$0 | 0, $4_1 | 0, i64toi32_i32$5 | 0, 15361 - $3_1 | 0 | 0);
   i64toi32_i32$4 = $2_1;
   i64toi32_i32$5 = HEAP32[i64toi32_i32$4 >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 4 | 0) >> 2] | 0;
   $4_1 = i64toi32_i32$5;
   $4$hi = i64toi32_i32$0;
   i64toi32_i32$4 = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$2 = 60;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$5 = 0;
    $49_1 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
   } else {
    i64toi32_i32$5 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
    $49_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$3 | 0) | 0;
   }
   $74_1 = $49_1;
   $74$hi = i64toi32_i32$5;
   i64toi32_i32$0 = $2_1 + 8 | 0;
   i64toi32_i32$5 = HEAP32[i64toi32_i32$0 >> 2] | 0;
   i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$2 = 4;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$5 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
    $50_1 = 0;
   } else {
    i64toi32_i32$5 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$3 | 0) | 0;
    $50_1 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
   }
   $78$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $74$hi;
   i64toi32_i32$4 = $74_1;
   i64toi32_i32$0 = $78$hi;
   i64toi32_i32$2 = $50_1;
   i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$0 | 0;
   $5_1 = i64toi32_i32$4 | i64toi32_i32$2 | 0;
   $5$hi = i64toi32_i32$0;
   label$5 : {
    i64toi32_i32$0 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$4 = 268435455;
    i64toi32_i32$2 = -1;
    i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
    $81 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
    $81$hi = i64toi32_i32$4;
    i64toi32_i32$0 = $2_1;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] | 0;
    $83 = i64toi32_i32$4;
    $83$hi = i64toi32_i32$5;
    i64toi32_i32$0 = (i64toi32_i32$0 + 16 | 0) + 8 | 0;
    i64toi32_i32$5 = HEAP32[i64toi32_i32$0 >> 2] | 0;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
    $87 = i64toi32_i32$5;
    $87$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $83$hi;
    i64toi32_i32$0 = $83;
    i64toi32_i32$5 = $87$hi;
    i64toi32_i32$2 = $87;
    i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 0;
    $89 = (i64toi32_i32$4 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$4 = 0;
    $90$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $81$hi;
    i64toi32_i32$2 = $81;
    i64toi32_i32$5 = $90$hi;
    i64toi32_i32$0 = $89;
    i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
    $4_1 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
    $4$hi = i64toi32_i32$5;
    i64toi32_i32$4 = $4_1;
    i64toi32_i32$2 = 134217728;
    i64toi32_i32$0 = 1;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$5 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0 | 0) | 0) {
     break label$5
    }
    i64toi32_i32$4 = $5$hi;
    i64toi32_i32$0 = $5_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$2 = 1;
    i64toi32_i32$3 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
    i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $5_1 = i64toi32_i32$3;
    $5$hi = i64toi32_i32$1;
    break label$1;
   }
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$4 = $4_1;
   i64toi32_i32$0 = 134217728;
   i64toi32_i32$2 = 0;
   i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
   i64toi32_i32$1 = i64toi32_i32$4 ^ i64toi32_i32$2 | 0;
   i64toi32_i32$4 = 0;
   i64toi32_i32$2 = 0;
   if ((i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$4 | 0) | 0) {
    break label$1
   }
   i64toi32_i32$1 = $5$hi;
   i64toi32_i32$2 = $5_1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$4 = 1;
   i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
   $100$hi = i64toi32_i32$0;
   i64toi32_i32$0 = i64toi32_i32$1;
   i64toi32_i32$0 = $100$hi;
   i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$4 | 0;
   i64toi32_i32$2 = $5$hi;
   i64toi32_i32$4 = $5_1;
   i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$4 | 0;
   i64toi32_i32$3 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
   if (i64toi32_i32$5 >>> 0 < i64toi32_i32$4 >>> 0) {
    i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
   }
   $5_1 = i64toi32_i32$5;
   $5$hi = i64toi32_i32$3;
  }
  global$0 = $2_1 + 32 | 0;
  i64toi32_i32$3 = $5$hi;
  i64toi32_i32$3 = $1$hi;
  i64toi32_i32$0 = $1_1;
  i64toi32_i32$1 = -2147483648;
  i64toi32_i32$4 = 0;
  i64toi32_i32$1 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
  $107 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
  $107$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$3 = $5_1;
  i64toi32_i32$0 = $107$hi;
  i64toi32_i32$4 = $107;
  i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
  wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$3 | i64toi32_i32$4 | 0 | 0);
  wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$0 | 0);
  return +(+wasm2js_scratch_load_f64());
 }
 
 function $49($0_1) {
  $0_1 = $0_1 | 0;
  var $4_1 = 0, $5_1 = 0, $6_1 = 0, $8_1 = 0, $3_1 = 0, $2_1 = 0, $11_1 = 0, $7_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $9_1 = 0, i64toi32_i32$2 = 0, $10_1 = 0, $1_1 = 0, $79 = 0, $92 = 0, $103 = 0, $111 = 0, $119 = 0, $210 = 0, $221 = 0, $229 = 0, $237 = 0, $272 = 0, $339 = 0, $346 = 0, $353 = 0, $444 = 0, $455 = 0, $463 = 0, $471 = 0, $1157 = 0, $1164 = 0, $1171 = 0, $1293 = 0, $1295 = 0, $1356 = 0, $1363 = 0, $1370 = 0, $1606 = 0, $1613 = 0, $1620 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             label$12 : {
              if ($0_1 >>> 0 > 244 >>> 0) {
               break label$12
              }
              label$13 : {
               $2_1 = HEAP32[(0 + 2132 | 0) >> 2] | 0;
               $3_1 = $0_1 >>> 0 < 11 >>> 0 ? 16 : ($0_1 + 11 | 0) & -8 | 0;
               $4_1 = $3_1 >>> 3 | 0;
               $0_1 = $2_1 >>> $4_1 | 0;
               if (!($0_1 & 3 | 0)) {
                break label$13
               }
               $5_1 = (($0_1 ^ -1 | 0) & 1 | 0) + $4_1 | 0;
               $6_1 = $5_1 << 3 | 0;
               $4_1 = HEAP32[($6_1 + 2180 | 0) >> 2] | 0;
               $0_1 = $4_1 + 8 | 0;
               label$14 : {
                label$15 : {
                 $3_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
                 $6_1 = $6_1 + 2172 | 0;
                 if (($3_1 | 0) != ($6_1 | 0)) {
                  break label$15
                 }
                 HEAP32[(0 + 2132 | 0) >> 2] = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
                 break label$14;
                }
                HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
                HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
               }
               $5_1 = $5_1 << 3 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 3 | 0;
               $4_1 = $4_1 + $5_1 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 1 | 0;
               break label$1;
              }
              $7_1 = HEAP32[(0 + 2140 | 0) >> 2] | 0;
              if ($3_1 >>> 0 <= $7_1 >>> 0) {
               break label$11
              }
              label$16 : {
               if (!$0_1) {
                break label$16
               }
               label$17 : {
                label$18 : {
                 $79 = $0_1 << $4_1 | 0;
                 $0_1 = 2 << $4_1 | 0;
                 $0_1 = $79 & ($0_1 | (0 - $0_1 | 0) | 0) | 0;
                 $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                 $92 = $0_1;
                 $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                 $4_1 = $92 >>> $0_1 | 0;
                 $5_1 = ($4_1 >>> 5 | 0) & 8 | 0;
                 $103 = $5_1 | $0_1 | 0;
                 $0_1 = $4_1 >>> $5_1 | 0;
                 $4_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                 $111 = $103 | $4_1 | 0;
                 $0_1 = $0_1 >>> $4_1 | 0;
                 $4_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                 $119 = $111 | $4_1 | 0;
                 $0_1 = $0_1 >>> $4_1 | 0;
                 $4_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                 $5_1 = ($119 | $4_1 | 0) + ($0_1 >>> $4_1 | 0) | 0;
                 $6_1 = $5_1 << 3 | 0;
                 $4_1 = HEAP32[($6_1 + 2180 | 0) >> 2] | 0;
                 $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
                 $6_1 = $6_1 + 2172 | 0;
                 if (($0_1 | 0) != ($6_1 | 0)) {
                  break label$18
                 }
                 $2_1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
                 HEAP32[(0 + 2132 | 0) >> 2] = $2_1;
                 break label$17;
                }
                HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
                HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
               }
               $0_1 = $4_1 + 8 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
               $6_1 = $4_1 + $3_1 | 0;
               $8_1 = $5_1 << 3 | 0;
               $5_1 = $8_1 - $3_1 | 0;
               HEAP32[($6_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
               HEAP32[($4_1 + $8_1 | 0) >> 2] = $5_1;
               label$19 : {
                if (!$7_1) {
                 break label$19
                }
                $8_1 = $7_1 >>> 3 | 0;
                $3_1 = ($8_1 << 3 | 0) + 2172 | 0;
                $4_1 = HEAP32[(0 + 2152 | 0) >> 2] | 0;
                label$20 : {
                 label$21 : {
                  $8_1 = 1 << $8_1 | 0;
                  if ($2_1 & $8_1 | 0) {
                   break label$21
                  }
                  HEAP32[(0 + 2132 | 0) >> 2] = $2_1 | $8_1 | 0;
                  $8_1 = $3_1;
                  break label$20;
                 }
                 $8_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
                }
                HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
                HEAP32[($8_1 + 12 | 0) >> 2] = $4_1;
                HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
                HEAP32[($4_1 + 8 | 0) >> 2] = $8_1;
               }
               HEAP32[(0 + 2152 | 0) >> 2] = $6_1;
               HEAP32[(0 + 2140 | 0) >> 2] = $5_1;
               break label$1;
              }
              $9_1 = HEAP32[(0 + 2136 | 0) >> 2] | 0;
              if (!$9_1) {
               break label$11
              }
              $0_1 = ($9_1 & (0 - $9_1 | 0) | 0) + -1 | 0;
              $210 = $0_1;
              $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
              $4_1 = $210 >>> $0_1 | 0;
              $5_1 = ($4_1 >>> 5 | 0) & 8 | 0;
              $221 = $5_1 | $0_1 | 0;
              $0_1 = $4_1 >>> $5_1 | 0;
              $4_1 = ($0_1 >>> 2 | 0) & 4 | 0;
              $229 = $221 | $4_1 | 0;
              $0_1 = $0_1 >>> $4_1 | 0;
              $4_1 = ($0_1 >>> 1 | 0) & 2 | 0;
              $237 = $229 | $4_1 | 0;
              $0_1 = $0_1 >>> $4_1 | 0;
              $4_1 = ($0_1 >>> 1 | 0) & 1 | 0;
              $6_1 = HEAP32[(((($237 | $4_1 | 0) + ($0_1 >>> $4_1 | 0) | 0) << 2 | 0) + 2436 | 0) >> 2] | 0;
              $4_1 = ((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
              $5_1 = $6_1;
              label$22 : {
               label$23 : while (1) {
                label$24 : {
                 $0_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
                 if ($0_1) {
                  break label$24
                 }
                 $0_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                 if (!$0_1) {
                  break label$22
                 }
                }
                $5_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                $272 = $5_1;
                $5_1 = $5_1 >>> 0 < $4_1 >>> 0;
                $4_1 = $5_1 ? $272 : $4_1;
                $6_1 = $5_1 ? $0_1 : $6_1;
                $5_1 = $0_1;
                continue label$23;
               };
              }
              $10_1 = HEAP32[($6_1 + 24 | 0) >> 2] | 0;
              label$25 : {
               $8_1 = HEAP32[($6_1 + 12 | 0) >> 2] | 0;
               if (($8_1 | 0) == ($6_1 | 0)) {
                break label$25
               }
               $0_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
               HEAP32[(0 + 2148 | 0) >> 2] | 0;
               HEAP32[($0_1 + 12 | 0) >> 2] = $8_1;
               HEAP32[($8_1 + 8 | 0) >> 2] = $0_1;
               break label$2;
              }
              label$26 : {
               $5_1 = $6_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                break label$26
               }
               $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$10
               }
               $5_1 = $6_1 + 16 | 0;
              }
              label$27 : while (1) {
               $11_1 = $5_1;
               $8_1 = $0_1;
               $5_1 = $0_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                continue label$27
               }
               $5_1 = $8_1 + 16 | 0;
               $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
               if ($0_1) {
                continue label$27
               }
               break label$27;
              };
              HEAP32[$11_1 >> 2] = 0;
              break label$2;
             }
             $3_1 = -1;
             if ($0_1 >>> 0 > -65 >>> 0) {
              break label$11
             }
             $0_1 = $0_1 + 11 | 0;
             $3_1 = $0_1 & -8 | 0;
             $7_1 = HEAP32[(0 + 2136 | 0) >> 2] | 0;
             if (!$7_1) {
              break label$11
             }
             $11_1 = 0;
             label$28 : {
              if ($3_1 >>> 0 < 256 >>> 0) {
               break label$28
              }
              $11_1 = 31;
              if ($3_1 >>> 0 > 16777215 >>> 0) {
               break label$28
              }
              $0_1 = $0_1 >>> 8 | 0;
              $339 = $0_1;
              $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
              $4_1 = $339 << $0_1 | 0;
              $346 = $4_1;
              $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
              $5_1 = $346 << $4_1 | 0;
              $353 = $5_1;
              $5_1 = (($5_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
              $0_1 = (($353 << $5_1 | 0) >>> 15 | 0) - ($0_1 | $4_1 | 0 | $5_1 | 0) | 0;
              $11_1 = ($0_1 << 1 | 0 | (($3_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
             }
             $4_1 = 0 - $3_1 | 0;
             label$29 : {
              label$30 : {
               label$31 : {
                label$32 : {
                 $5_1 = HEAP32[(($11_1 << 2 | 0) + 2436 | 0) >> 2] | 0;
                 if ($5_1) {
                  break label$32
                 }
                 $0_1 = 0;
                 $8_1 = 0;
                 break label$31;
                }
                $0_1 = 0;
                $6_1 = $3_1 << (($11_1 | 0) == (31 | 0) ? 0 : 25 - ($11_1 >>> 1 | 0) | 0) | 0;
                $8_1 = 0;
                label$33 : while (1) {
                 label$34 : {
                  $2_1 = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                  if ($2_1 >>> 0 >= $4_1 >>> 0) {
                   break label$34
                  }
                  $4_1 = $2_1;
                  $8_1 = $5_1;
                  if ($4_1) {
                   break label$34
                  }
                  $4_1 = 0;
                  $8_1 = $5_1;
                  $0_1 = $5_1;
                  break label$30;
                 }
                 $2_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                 $5_1 = HEAP32[(($5_1 + (($6_1 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
                 $0_1 = $2_1 ? (($2_1 | 0) == ($5_1 | 0) ? $0_1 : $2_1) : $0_1;
                 $6_1 = $6_1 << 1 | 0;
                 if ($5_1) {
                  continue label$33
                 }
                 break label$33;
                };
               }
               label$35 : {
                if ($0_1 | $8_1 | 0) {
                 break label$35
                }
                $8_1 = 0;
                $0_1 = 2 << $11_1 | 0;
                $0_1 = ($0_1 | (0 - $0_1 | 0) | 0) & $7_1 | 0;
                if (!$0_1) {
                 break label$11
                }
                $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                $444 = $0_1;
                $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                $5_1 = $444 >>> $0_1 | 0;
                $6_1 = ($5_1 >>> 5 | 0) & 8 | 0;
                $455 = $6_1 | $0_1 | 0;
                $0_1 = $5_1 >>> $6_1 | 0;
                $5_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                $463 = $455 | $5_1 | 0;
                $0_1 = $0_1 >>> $5_1 | 0;
                $5_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                $471 = $463 | $5_1 | 0;
                $0_1 = $0_1 >>> $5_1 | 0;
                $5_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                $0_1 = HEAP32[(((($471 | $5_1 | 0) + ($0_1 >>> $5_1 | 0) | 0) << 2 | 0) + 2436 | 0) >> 2] | 0;
               }
               if (!$0_1) {
                break label$29
               }
              }
              label$36 : while (1) {
               $2_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
               $6_1 = $2_1 >>> 0 < $4_1 >>> 0;
               label$37 : {
                $5_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
                if ($5_1) {
                 break label$37
                }
                $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
               }
               $4_1 = $6_1 ? $2_1 : $4_1;
               $8_1 = $6_1 ? $0_1 : $8_1;
               $0_1 = $5_1;
               if ($0_1) {
                continue label$36
               }
               break label$36;
              };
             }
             if (!$8_1) {
              break label$11
             }
             if ($4_1 >>> 0 >= ((HEAP32[(0 + 2140 | 0) >> 2] | 0) - $3_1 | 0) >>> 0) {
              break label$11
             }
             $11_1 = HEAP32[($8_1 + 24 | 0) >> 2] | 0;
             label$38 : {
              $6_1 = HEAP32[($8_1 + 12 | 0) >> 2] | 0;
              if (($6_1 | 0) == ($8_1 | 0)) {
               break label$38
              }
              $0_1 = HEAP32[($8_1 + 8 | 0) >> 2] | 0;
              HEAP32[(0 + 2148 | 0) >> 2] | 0;
              HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
              HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
              break label$3;
             }
             label$39 : {
              $5_1 = $8_1 + 20 | 0;
              $0_1 = HEAP32[$5_1 >> 2] | 0;
              if ($0_1) {
               break label$39
              }
              $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$9
              }
              $5_1 = $8_1 + 16 | 0;
             }
             label$40 : while (1) {
              $2_1 = $5_1;
              $6_1 = $0_1;
              $5_1 = $0_1 + 20 | 0;
              $0_1 = HEAP32[$5_1 >> 2] | 0;
              if ($0_1) {
               continue label$40
              }
              $5_1 = $6_1 + 16 | 0;
              $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
              if ($0_1) {
               continue label$40
              }
              break label$40;
             };
             HEAP32[$2_1 >> 2] = 0;
             break label$3;
            }
            label$41 : {
             $0_1 = HEAP32[(0 + 2140 | 0) >> 2] | 0;
             if ($0_1 >>> 0 < $3_1 >>> 0) {
              break label$41
             }
             $4_1 = HEAP32[(0 + 2152 | 0) >> 2] | 0;
             label$42 : {
              label$43 : {
               $5_1 = $0_1 - $3_1 | 0;
               if ($5_1 >>> 0 < 16 >>> 0) {
                break label$43
               }
               HEAP32[(0 + 2140 | 0) >> 2] = $5_1;
               $6_1 = $4_1 + $3_1 | 0;
               HEAP32[(0 + 2152 | 0) >> 2] = $6_1;
               HEAP32[($6_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
               HEAP32[($4_1 + $0_1 | 0) >> 2] = $5_1;
               HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
               break label$42;
              }
              HEAP32[(0 + 2152 | 0) >> 2] = 0;
              HEAP32[(0 + 2140 | 0) >> 2] = 0;
              HEAP32[($4_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
              $0_1 = $4_1 + $0_1 | 0;
              HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
             }
             $0_1 = $4_1 + 8 | 0;
             break label$1;
            }
            label$44 : {
             $6_1 = HEAP32[(0 + 2144 | 0) >> 2] | 0;
             if ($6_1 >>> 0 <= $3_1 >>> 0) {
              break label$44
             }
             $4_1 = $6_1 - $3_1 | 0;
             HEAP32[(0 + 2144 | 0) >> 2] = $4_1;
             $0_1 = HEAP32[(0 + 2156 | 0) >> 2] | 0;
             $5_1 = $0_1 + $3_1 | 0;
             HEAP32[(0 + 2156 | 0) >> 2] = $5_1;
             HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
             HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
             $0_1 = $0_1 + 8 | 0;
             break label$1;
            }
            label$45 : {
             label$46 : {
              if (!(HEAP32[(0 + 2604 | 0) >> 2] | 0)) {
               break label$46
              }
              $4_1 = HEAP32[(0 + 2612 | 0) >> 2] | 0;
              break label$45;
             }
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = -1;
             HEAP32[(i64toi32_i32$1 + 2616 | 0) >> 2] = -1;
             HEAP32[(i64toi32_i32$1 + 2620 | 0) >> 2] = i64toi32_i32$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = 4096;
             HEAP32[(i64toi32_i32$1 + 2608 | 0) >> 2] = 4096;
             HEAP32[(i64toi32_i32$1 + 2612 | 0) >> 2] = i64toi32_i32$0;
             HEAP32[(0 + 2604 | 0) >> 2] = (($1_1 + 12 | 0) & -16 | 0) ^ 1431655768 | 0;
             HEAP32[(0 + 2624 | 0) >> 2] = 0;
             HEAP32[(0 + 2576 | 0) >> 2] = 0;
             $4_1 = 4096;
            }
            $0_1 = 0;
            $7_1 = $3_1 + 47 | 0;
            $2_1 = $4_1 + $7_1 | 0;
            $11_1 = 0 - $4_1 | 0;
            $8_1 = $2_1 & $11_1 | 0;
            if ($8_1 >>> 0 <= $3_1 >>> 0) {
             break label$1
            }
            $0_1 = 0;
            label$47 : {
             $4_1 = HEAP32[(0 + 2572 | 0) >> 2] | 0;
             if (!$4_1) {
              break label$47
             }
             $5_1 = HEAP32[(0 + 2564 | 0) >> 2] | 0;
             $9_1 = $5_1 + $8_1 | 0;
             if ($9_1 >>> 0 <= $5_1 >>> 0) {
              break label$1
             }
             if ($9_1 >>> 0 > $4_1 >>> 0) {
              break label$1
             }
            }
            if ((HEAPU8[(0 + 2576 | 0) >> 0] | 0) & 4 | 0) {
             break label$6
            }
            label$48 : {
             label$49 : {
              label$50 : {
               $4_1 = HEAP32[(0 + 2156 | 0) >> 2] | 0;
               if (!$4_1) {
                break label$50
               }
               $0_1 = 2580;
               label$51 : while (1) {
                label$52 : {
                 $5_1 = HEAP32[$0_1 >> 2] | 0;
                 if ($5_1 >>> 0 > $4_1 >>> 0) {
                  break label$52
                 }
                 if (($5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0) >>> 0 > $4_1 >>> 0) {
                  break label$49
                 }
                }
                $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                if ($0_1) {
                 continue label$51
                }
                break label$51;
               };
              }
              $6_1 = $51(0 | 0) | 0;
              if (($6_1 | 0) == (-1 | 0)) {
               break label$7
              }
              $2_1 = $8_1;
              label$53 : {
               $0_1 = HEAP32[(0 + 2608 | 0) >> 2] | 0;
               $4_1 = $0_1 + -1 | 0;
               if (!($4_1 & $6_1 | 0)) {
                break label$53
               }
               $2_1 = ($8_1 - $6_1 | 0) + (($4_1 + $6_1 | 0) & (0 - $0_1 | 0) | 0) | 0;
              }
              if ($2_1 >>> 0 <= $3_1 >>> 0) {
               break label$7
              }
              if ($2_1 >>> 0 > 2147483646 >>> 0) {
               break label$7
              }
              label$54 : {
               $0_1 = HEAP32[(0 + 2572 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$54
               }
               $4_1 = HEAP32[(0 + 2564 | 0) >> 2] | 0;
               $5_1 = $4_1 + $2_1 | 0;
               if ($5_1 >>> 0 <= $4_1 >>> 0) {
                break label$7
               }
               if ($5_1 >>> 0 > $0_1 >>> 0) {
                break label$7
               }
              }
              $0_1 = $51($2_1 | 0) | 0;
              if (($0_1 | 0) != ($6_1 | 0)) {
               break label$48
              }
              break label$5;
             }
             $2_1 = ($2_1 - $6_1 | 0) & $11_1 | 0;
             if ($2_1 >>> 0 > 2147483646 >>> 0) {
              break label$7
             }
             $6_1 = $51($2_1 | 0) | 0;
             if (($6_1 | 0) == ((HEAP32[$0_1 >> 2] | 0) + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0 | 0)) {
              break label$8
             }
             $0_1 = $6_1;
            }
            label$55 : {
             if (($0_1 | 0) == (-1 | 0)) {
              break label$55
             }
             if (($3_1 + 48 | 0) >>> 0 <= $2_1 >>> 0) {
              break label$55
             }
             label$56 : {
              $4_1 = HEAP32[(0 + 2612 | 0) >> 2] | 0;
              $4_1 = (($7_1 - $2_1 | 0) + $4_1 | 0) & (0 - $4_1 | 0) | 0;
              if ($4_1 >>> 0 <= 2147483646 >>> 0) {
               break label$56
              }
              $6_1 = $0_1;
              break label$5;
             }
             label$57 : {
              if (($51($4_1 | 0) | 0 | 0) == (-1 | 0)) {
               break label$57
              }
              $2_1 = $4_1 + $2_1 | 0;
              $6_1 = $0_1;
              break label$5;
             }
             $51(0 - $2_1 | 0 | 0) | 0;
             break label$7;
            }
            $6_1 = $0_1;
            if (($0_1 | 0) != (-1 | 0)) {
             break label$5
            }
            break label$7;
           }
           $8_1 = 0;
           break label$2;
          }
          $6_1 = 0;
          break label$3;
         }
         if (($6_1 | 0) != (-1 | 0)) {
          break label$5
         }
        }
        HEAP32[(0 + 2576 | 0) >> 2] = HEAP32[(0 + 2576 | 0) >> 2] | 0 | 4 | 0;
       }
       if ($8_1 >>> 0 > 2147483646 >>> 0) {
        break label$4
       }
       $6_1 = $51($8_1 | 0) | 0;
       $0_1 = $51(0 | 0) | 0;
       if (($6_1 | 0) == (-1 | 0)) {
        break label$4
       }
       if (($0_1 | 0) == (-1 | 0)) {
        break label$4
       }
       if ($6_1 >>> 0 >= $0_1 >>> 0) {
        break label$4
       }
       $2_1 = $0_1 - $6_1 | 0;
       if ($2_1 >>> 0 <= ($3_1 + 40 | 0) >>> 0) {
        break label$4
       }
      }
      $0_1 = (HEAP32[(0 + 2564 | 0) >> 2] | 0) + $2_1 | 0;
      HEAP32[(0 + 2564 | 0) >> 2] = $0_1;
      label$58 : {
       if ($0_1 >>> 0 <= (HEAP32[(0 + 2568 | 0) >> 2] | 0) >>> 0) {
        break label$58
       }
       HEAP32[(0 + 2568 | 0) >> 2] = $0_1;
      }
      label$59 : {
       label$60 : {
        label$61 : {
         label$62 : {
          $4_1 = HEAP32[(0 + 2156 | 0) >> 2] | 0;
          if (!$4_1) {
           break label$62
          }
          $0_1 = 2580;
          label$63 : while (1) {
           $5_1 = HEAP32[$0_1 >> 2] | 0;
           $8_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
           if (($6_1 | 0) == ($5_1 + $8_1 | 0 | 0)) {
            break label$61
           }
           $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
           if ($0_1) {
            continue label$63
           }
           break label$60;
          };
         }
         label$64 : {
          label$65 : {
           $0_1 = HEAP32[(0 + 2148 | 0) >> 2] | 0;
           if (!$0_1) {
            break label$65
           }
           if ($6_1 >>> 0 >= $0_1 >>> 0) {
            break label$64
           }
          }
          HEAP32[(0 + 2148 | 0) >> 2] = $6_1;
         }
         $0_1 = 0;
         HEAP32[(0 + 2584 | 0) >> 2] = $2_1;
         HEAP32[(0 + 2580 | 0) >> 2] = $6_1;
         HEAP32[(0 + 2164 | 0) >> 2] = -1;
         HEAP32[(0 + 2168 | 0) >> 2] = HEAP32[(0 + 2604 | 0) >> 2] | 0;
         HEAP32[(0 + 2592 | 0) >> 2] = 0;
         label$66 : while (1) {
          $4_1 = $0_1 << 3 | 0;
          $5_1 = $4_1 + 2172 | 0;
          HEAP32[($4_1 + 2180 | 0) >> 2] = $5_1;
          HEAP32[($4_1 + 2184 | 0) >> 2] = $5_1;
          $0_1 = $0_1 + 1 | 0;
          if (($0_1 | 0) != (32 | 0)) {
           continue label$66
          }
          break label$66;
         };
         $0_1 = $2_1 + -40 | 0;
         $4_1 = ($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0;
         $5_1 = $0_1 - $4_1 | 0;
         HEAP32[(0 + 2144 | 0) >> 2] = $5_1;
         $4_1 = $6_1 + $4_1 | 0;
         HEAP32[(0 + 2156 | 0) >> 2] = $4_1;
         HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
         HEAP32[(($6_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
         HEAP32[(0 + 2160 | 0) >> 2] = HEAP32[(0 + 2620 | 0) >> 2] | 0;
         break label$59;
        }
        if ((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0) {
         break label$60
        }
        if ($5_1 >>> 0 > $4_1 >>> 0) {
         break label$60
        }
        if ($6_1 >>> 0 <= $4_1 >>> 0) {
         break label$60
        }
        HEAP32[($0_1 + 4 | 0) >> 2] = $8_1 + $2_1 | 0;
        $0_1 = ($4_1 + 8 | 0) & 7 | 0 ? (-8 - $4_1 | 0) & 7 | 0 : 0;
        $5_1 = $4_1 + $0_1 | 0;
        HEAP32[(0 + 2156 | 0) >> 2] = $5_1;
        $6_1 = (HEAP32[(0 + 2144 | 0) >> 2] | 0) + $2_1 | 0;
        $0_1 = $6_1 - $0_1 | 0;
        HEAP32[(0 + 2144 | 0) >> 2] = $0_1;
        HEAP32[($5_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
        HEAP32[(($4_1 + $6_1 | 0) + 4 | 0) >> 2] = 40;
        HEAP32[(0 + 2160 | 0) >> 2] = HEAP32[(0 + 2620 | 0) >> 2] | 0;
        break label$59;
       }
       label$67 : {
        $8_1 = HEAP32[(0 + 2148 | 0) >> 2] | 0;
        if ($6_1 >>> 0 >= $8_1 >>> 0) {
         break label$67
        }
        HEAP32[(0 + 2148 | 0) >> 2] = $6_1;
        $8_1 = $6_1;
       }
       $5_1 = $6_1 + $2_1 | 0;
       $0_1 = 2580;
       label$68 : {
        label$69 : {
         label$70 : {
          label$71 : {
           label$72 : {
            label$73 : {
             label$74 : {
              label$75 : while (1) {
               if ((HEAP32[$0_1 >> 2] | 0 | 0) == ($5_1 | 0)) {
                break label$74
               }
               $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
               if ($0_1) {
                continue label$75
               }
               break label$73;
              };
             }
             if (!((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0)) {
              break label$72
             }
            }
            $0_1 = 2580;
            label$76 : while (1) {
             label$77 : {
              $5_1 = HEAP32[$0_1 >> 2] | 0;
              if ($5_1 >>> 0 > $4_1 >>> 0) {
               break label$77
              }
              $5_1 = $5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0;
              if ($5_1 >>> 0 > $4_1 >>> 0) {
               break label$71
              }
             }
             $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
             continue label$76;
            };
           }
           HEAP32[$0_1 >> 2] = $6_1;
           HEAP32[($0_1 + 4 | 0) >> 2] = (HEAP32[($0_1 + 4 | 0) >> 2] | 0) + $2_1 | 0;
           $11_1 = $6_1 + (($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0) | 0;
           HEAP32[($11_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
           $2_1 = $5_1 + (($5_1 + 8 | 0) & 7 | 0 ? (-8 - $5_1 | 0) & 7 | 0 : 0) | 0;
           $3_1 = $11_1 + $3_1 | 0;
           $5_1 = $2_1 - $3_1 | 0;
           label$78 : {
            if (($4_1 | 0) != ($2_1 | 0)) {
             break label$78
            }
            HEAP32[(0 + 2156 | 0) >> 2] = $3_1;
            $0_1 = (HEAP32[(0 + 2144 | 0) >> 2] | 0) + $5_1 | 0;
            HEAP32[(0 + 2144 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
            break label$69;
           }
           label$79 : {
            if ((HEAP32[(0 + 2152 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
             break label$79
            }
            HEAP32[(0 + 2152 | 0) >> 2] = $3_1;
            $0_1 = (HEAP32[(0 + 2140 | 0) >> 2] | 0) + $5_1 | 0;
            HEAP32[(0 + 2140 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
            HEAP32[($3_1 + $0_1 | 0) >> 2] = $0_1;
            break label$69;
           }
           label$80 : {
            $0_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
            if (($0_1 & 3 | 0 | 0) != (1 | 0)) {
             break label$80
            }
            $7_1 = $0_1 & -8 | 0;
            label$81 : {
             label$82 : {
              if ($0_1 >>> 0 > 255 >>> 0) {
               break label$82
              }
              $4_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
              $8_1 = $0_1 >>> 3 | 0;
              $6_1 = ($8_1 << 3 | 0) + 2172 | 0;
              label$83 : {
               $0_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
               if (($0_1 | 0) != ($4_1 | 0)) {
                break label$83
               }
               HEAP32[(0 + 2132 | 0) >> 2] = (HEAP32[(0 + 2132 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0;
               break label$81;
              }
              HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
              HEAP32[($0_1 + 8 | 0) >> 2] = $4_1;
              break label$81;
             }
             $9_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
             label$84 : {
              label$85 : {
               $6_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
               if (($6_1 | 0) == ($2_1 | 0)) {
                break label$85
               }
               $0_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
               HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
               HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
               break label$84;
              }
              label$86 : {
               $0_1 = $2_1 + 20 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                break label$86
               }
               $0_1 = $2_1 + 16 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                break label$86
               }
               $6_1 = 0;
               break label$84;
              }
              label$87 : while (1) {
               $8_1 = $0_1;
               $6_1 = $4_1;
               $0_1 = $4_1 + 20 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                continue label$87
               }
               $0_1 = $6_1 + 16 | 0;
               $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
               if ($4_1) {
                continue label$87
               }
               break label$87;
              };
              HEAP32[$8_1 >> 2] = 0;
             }
             if (!$9_1) {
              break label$81
             }
             label$88 : {
              label$89 : {
               $4_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
               $0_1 = ($4_1 << 2 | 0) + 2436 | 0;
               if ((HEAP32[$0_1 >> 2] | 0 | 0) != ($2_1 | 0)) {
                break label$89
               }
               HEAP32[$0_1 >> 2] = $6_1;
               if ($6_1) {
                break label$88
               }
               HEAP32[(0 + 2136 | 0) >> 2] = (HEAP32[(0 + 2136 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0;
               break label$81;
              }
              HEAP32[($9_1 + ((HEAP32[($9_1 + 16 | 0) >> 2] | 0 | 0) == ($2_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
              if (!$6_1) {
               break label$81
              }
             }
             HEAP32[($6_1 + 24 | 0) >> 2] = $9_1;
             label$90 : {
              $0_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$90
              }
              HEAP32[($6_1 + 16 | 0) >> 2] = $0_1;
              HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
             }
             $0_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
             if (!$0_1) {
              break label$81
             }
             HEAP32[($6_1 + 20 | 0) >> 2] = $0_1;
             HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
            }
            $5_1 = $7_1 + $5_1 | 0;
            $2_1 = $2_1 + $7_1 | 0;
           }
           HEAP32[($2_1 + 4 | 0) >> 2] = (HEAP32[($2_1 + 4 | 0) >> 2] | 0) & -2 | 0;
           HEAP32[($3_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
           HEAP32[($3_1 + $5_1 | 0) >> 2] = $5_1;
           label$91 : {
            if ($5_1 >>> 0 > 255 >>> 0) {
             break label$91
            }
            $4_1 = $5_1 >>> 3 | 0;
            $0_1 = ($4_1 << 3 | 0) + 2172 | 0;
            label$92 : {
             label$93 : {
              $5_1 = HEAP32[(0 + 2132 | 0) >> 2] | 0;
              $4_1 = 1 << $4_1 | 0;
              if ($5_1 & $4_1 | 0) {
               break label$93
              }
              HEAP32[(0 + 2132 | 0) >> 2] = $5_1 | $4_1 | 0;
              $4_1 = $0_1;
              break label$92;
             }
             $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
            }
            HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
            HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
            HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
            break label$69;
           }
           $0_1 = 31;
           label$94 : {
            if ($5_1 >>> 0 > 16777215 >>> 0) {
             break label$94
            }
            $0_1 = $5_1 >>> 8 | 0;
            $1157 = $0_1;
            $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
            $4_1 = $1157 << $0_1 | 0;
            $1164 = $4_1;
            $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
            $6_1 = $1164 << $4_1 | 0;
            $1171 = $6_1;
            $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
            $0_1 = (($1171 << $6_1 | 0) >>> 15 | 0) - ($0_1 | $4_1 | 0 | $6_1 | 0) | 0;
            $0_1 = ($0_1 << 1 | 0 | (($5_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
           }
           HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
           i64toi32_i32$1 = $3_1;
           i64toi32_i32$0 = 0;
           HEAP32[($3_1 + 16 | 0) >> 2] = 0;
           HEAP32[($3_1 + 20 | 0) >> 2] = i64toi32_i32$0;
           $4_1 = ($0_1 << 2 | 0) + 2436 | 0;
           label$95 : {
            label$96 : {
             $6_1 = HEAP32[(0 + 2136 | 0) >> 2] | 0;
             $8_1 = 1 << $0_1 | 0;
             if ($6_1 & $8_1 | 0) {
              break label$96
             }
             HEAP32[(0 + 2136 | 0) >> 2] = $6_1 | $8_1 | 0;
             HEAP32[$4_1 >> 2] = $3_1;
             HEAP32[($3_1 + 24 | 0) >> 2] = $4_1;
             break label$95;
            }
            $0_1 = $5_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
            $6_1 = HEAP32[$4_1 >> 2] | 0;
            label$97 : while (1) {
             $4_1 = $6_1;
             if (((HEAP32[($4_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($5_1 | 0)) {
              break label$70
             }
             $6_1 = $0_1 >>> 29 | 0;
             $0_1 = $0_1 << 1 | 0;
             $8_1 = ($4_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
             $6_1 = HEAP32[$8_1 >> 2] | 0;
             if ($6_1) {
              continue label$97
             }
             break label$97;
            };
            HEAP32[$8_1 >> 2] = $3_1;
            HEAP32[($3_1 + 24 | 0) >> 2] = $4_1;
           }
           HEAP32[($3_1 + 12 | 0) >> 2] = $3_1;
           HEAP32[($3_1 + 8 | 0) >> 2] = $3_1;
           break label$69;
          }
          $0_1 = $2_1 + -40 | 0;
          $8_1 = ($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0;
          $11_1 = $0_1 - $8_1 | 0;
          HEAP32[(0 + 2144 | 0) >> 2] = $11_1;
          $8_1 = $6_1 + $8_1 | 0;
          HEAP32[(0 + 2156 | 0) >> 2] = $8_1;
          HEAP32[($8_1 + 4 | 0) >> 2] = $11_1 | 1 | 0;
          HEAP32[(($6_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
          HEAP32[(0 + 2160 | 0) >> 2] = HEAP32[(0 + 2620 | 0) >> 2] | 0;
          $0_1 = ($5_1 + (($5_1 + -39 | 0) & 7 | 0 ? (39 - $5_1 | 0) & 7 | 0 : 0) | 0) + -47 | 0;
          $8_1 = $0_1 >>> 0 < ($4_1 + 16 | 0) >>> 0 ? $4_1 : $0_1;
          HEAP32[($8_1 + 4 | 0) >> 2] = 27;
          i64toi32_i32$2 = 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 2588 | 0) >> 2] | 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 2592 | 0) >> 2] | 0;
          $1293 = i64toi32_i32$0;
          i64toi32_i32$0 = $8_1 + 16 | 0;
          HEAP32[i64toi32_i32$0 >> 2] = $1293;
          HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
          i64toi32_i32$2 = 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 2580 | 0) >> 2] | 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 2584 | 0) >> 2] | 0;
          $1295 = i64toi32_i32$1;
          i64toi32_i32$1 = $8_1;
          HEAP32[($8_1 + 8 | 0) >> 2] = $1295;
          HEAP32[($8_1 + 12 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[(0 + 2588 | 0) >> 2] = $8_1 + 8 | 0;
          HEAP32[(0 + 2584 | 0) >> 2] = $2_1;
          HEAP32[(0 + 2580 | 0) >> 2] = $6_1;
          HEAP32[(0 + 2592 | 0) >> 2] = 0;
          $0_1 = $8_1 + 24 | 0;
          label$98 : while (1) {
           HEAP32[($0_1 + 4 | 0) >> 2] = 7;
           $6_1 = $0_1 + 8 | 0;
           $0_1 = $0_1 + 4 | 0;
           if ($5_1 >>> 0 > $6_1 >>> 0) {
            continue label$98
           }
           break label$98;
          };
          if (($8_1 | 0) == ($4_1 | 0)) {
           break label$59
          }
          HEAP32[($8_1 + 4 | 0) >> 2] = (HEAP32[($8_1 + 4 | 0) >> 2] | 0) & -2 | 0;
          $2_1 = $8_1 - $4_1 | 0;
          HEAP32[($4_1 + 4 | 0) >> 2] = $2_1 | 1 | 0;
          HEAP32[$8_1 >> 2] = $2_1;
          label$99 : {
           if ($2_1 >>> 0 > 255 >>> 0) {
            break label$99
           }
           $5_1 = $2_1 >>> 3 | 0;
           $0_1 = ($5_1 << 3 | 0) + 2172 | 0;
           label$100 : {
            label$101 : {
             $6_1 = HEAP32[(0 + 2132 | 0) >> 2] | 0;
             $5_1 = 1 << $5_1 | 0;
             if ($6_1 & $5_1 | 0) {
              break label$101
             }
             HEAP32[(0 + 2132 | 0) >> 2] = $6_1 | $5_1 | 0;
             $5_1 = $0_1;
             break label$100;
            }
            $5_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
           }
           HEAP32[($0_1 + 8 | 0) >> 2] = $4_1;
           HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
           HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
           HEAP32[($4_1 + 8 | 0) >> 2] = $5_1;
           break label$59;
          }
          $0_1 = 31;
          label$102 : {
           if ($2_1 >>> 0 > 16777215 >>> 0) {
            break label$102
           }
           $0_1 = $2_1 >>> 8 | 0;
           $1356 = $0_1;
           $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
           $5_1 = $1356 << $0_1 | 0;
           $1363 = $5_1;
           $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
           $6_1 = $1363 << $5_1 | 0;
           $1370 = $6_1;
           $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
           $0_1 = (($1370 << $6_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $6_1 | 0) | 0;
           $0_1 = ($0_1 << 1 | 0 | (($2_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
          }
          i64toi32_i32$1 = $4_1;
          i64toi32_i32$0 = 0;
          HEAP32[($4_1 + 16 | 0) >> 2] = 0;
          HEAP32[($4_1 + 20 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
          $5_1 = ($0_1 << 2 | 0) + 2436 | 0;
          label$103 : {
           label$104 : {
            $6_1 = HEAP32[(0 + 2136 | 0) >> 2] | 0;
            $8_1 = 1 << $0_1 | 0;
            if ($6_1 & $8_1 | 0) {
             break label$104
            }
            HEAP32[(0 + 2136 | 0) >> 2] = $6_1 | $8_1 | 0;
            HEAP32[$5_1 >> 2] = $4_1;
            HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
            break label$103;
           }
           $0_1 = $2_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
           $6_1 = HEAP32[$5_1 >> 2] | 0;
           label$105 : while (1) {
            $5_1 = $6_1;
            if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($2_1 | 0)) {
             break label$68
            }
            $6_1 = $0_1 >>> 29 | 0;
            $0_1 = $0_1 << 1 | 0;
            $8_1 = ($5_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
            $6_1 = HEAP32[$8_1 >> 2] | 0;
            if ($6_1) {
             continue label$105
            }
            break label$105;
           };
           HEAP32[$8_1 >> 2] = $4_1;
           HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
          }
          HEAP32[($4_1 + 12 | 0) >> 2] = $4_1;
          HEAP32[($4_1 + 8 | 0) >> 2] = $4_1;
          break label$59;
         }
         $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
         HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
         HEAP32[($4_1 + 8 | 0) >> 2] = $3_1;
         HEAP32[($3_1 + 24 | 0) >> 2] = 0;
         HEAP32[($3_1 + 12 | 0) >> 2] = $4_1;
         HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
        }
        $0_1 = $11_1 + 8 | 0;
        break label$1;
       }
       $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
       HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $4_1;
       HEAP32[($4_1 + 24 | 0) >> 2] = 0;
       HEAP32[($4_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
      }
      $0_1 = HEAP32[(0 + 2144 | 0) >> 2] | 0;
      if ($0_1 >>> 0 <= $3_1 >>> 0) {
       break label$4
      }
      $4_1 = $0_1 - $3_1 | 0;
      HEAP32[(0 + 2144 | 0) >> 2] = $4_1;
      $0_1 = HEAP32[(0 + 2156 | 0) >> 2] | 0;
      $5_1 = $0_1 + $3_1 | 0;
      HEAP32[(0 + 2156 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
      $0_1 = $0_1 + 8 | 0;
      break label$1;
     }
     HEAP32[($13() | 0) >> 2] = 48;
     $0_1 = 0;
     break label$1;
    }
    label$106 : {
     if (!$11_1) {
      break label$106
     }
     label$107 : {
      label$108 : {
       $5_1 = HEAP32[($8_1 + 28 | 0) >> 2] | 0;
       $0_1 = ($5_1 << 2 | 0) + 2436 | 0;
       if (($8_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
        break label$108
       }
       HEAP32[$0_1 >> 2] = $6_1;
       if ($6_1) {
        break label$107
       }
       $7_1 = $7_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
       HEAP32[(0 + 2136 | 0) >> 2] = $7_1;
       break label$106;
      }
      HEAP32[($11_1 + ((HEAP32[($11_1 + 16 | 0) >> 2] | 0 | 0) == ($8_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
      if (!$6_1) {
       break label$106
      }
     }
     HEAP32[($6_1 + 24 | 0) >> 2] = $11_1;
     label$109 : {
      $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
      if (!$0_1) {
       break label$109
      }
      HEAP32[($6_1 + 16 | 0) >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
     }
     $0_1 = HEAP32[($8_1 + 20 | 0) >> 2] | 0;
     if (!$0_1) {
      break label$106
     }
     HEAP32[($6_1 + 20 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
    }
    label$110 : {
     label$111 : {
      if ($4_1 >>> 0 > 15 >>> 0) {
       break label$111
      }
      $0_1 = $4_1 + $3_1 | 0;
      HEAP32[($8_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
      $0_1 = $8_1 + $0_1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      break label$110;
     }
     HEAP32[($8_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
     $6_1 = $8_1 + $3_1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
     HEAP32[($6_1 + $4_1 | 0) >> 2] = $4_1;
     label$112 : {
      if ($4_1 >>> 0 > 255 >>> 0) {
       break label$112
      }
      $4_1 = $4_1 >>> 3 | 0;
      $0_1 = ($4_1 << 3 | 0) + 2172 | 0;
      label$113 : {
       label$114 : {
        $5_1 = HEAP32[(0 + 2132 | 0) >> 2] | 0;
        $4_1 = 1 << $4_1 | 0;
        if ($5_1 & $4_1 | 0) {
         break label$114
        }
        HEAP32[(0 + 2132 | 0) >> 2] = $5_1 | $4_1 | 0;
        $4_1 = $0_1;
        break label$113;
       }
       $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
      }
      HEAP32[($0_1 + 8 | 0) >> 2] = $6_1;
      HEAP32[($4_1 + 12 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
      HEAP32[($6_1 + 8 | 0) >> 2] = $4_1;
      break label$110;
     }
     $0_1 = 31;
     label$115 : {
      if ($4_1 >>> 0 > 16777215 >>> 0) {
       break label$115
      }
      $0_1 = $4_1 >>> 8 | 0;
      $1606 = $0_1;
      $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
      $5_1 = $1606 << $0_1 | 0;
      $1613 = $5_1;
      $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
      $3_1 = $1613 << $5_1 | 0;
      $1620 = $3_1;
      $3_1 = (($3_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
      $0_1 = (($1620 << $3_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $3_1 | 0) | 0;
      $0_1 = ($0_1 << 1 | 0 | (($4_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
     }
     HEAP32[($6_1 + 28 | 0) >> 2] = $0_1;
     i64toi32_i32$1 = $6_1;
     i64toi32_i32$0 = 0;
     HEAP32[($6_1 + 16 | 0) >> 2] = 0;
     HEAP32[($6_1 + 20 | 0) >> 2] = i64toi32_i32$0;
     $5_1 = ($0_1 << 2 | 0) + 2436 | 0;
     label$116 : {
      label$117 : {
       label$118 : {
        $3_1 = 1 << $0_1 | 0;
        if ($7_1 & $3_1 | 0) {
         break label$118
        }
        HEAP32[(0 + 2136 | 0) >> 2] = $7_1 | $3_1 | 0;
        HEAP32[$5_1 >> 2] = $6_1;
        HEAP32[($6_1 + 24 | 0) >> 2] = $5_1;
        break label$117;
       }
       $0_1 = $4_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
       $3_1 = HEAP32[$5_1 >> 2] | 0;
       label$119 : while (1) {
        $5_1 = $3_1;
        if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($4_1 | 0)) {
         break label$116
        }
        $3_1 = $0_1 >>> 29 | 0;
        $0_1 = $0_1 << 1 | 0;
        $2_1 = ($5_1 + ($3_1 & 4 | 0) | 0) + 16 | 0;
        $3_1 = HEAP32[$2_1 >> 2] | 0;
        if ($3_1) {
         continue label$119
        }
        break label$119;
       };
       HEAP32[$2_1 >> 2] = $6_1;
       HEAP32[($6_1 + 24 | 0) >> 2] = $5_1;
      }
      HEAP32[($6_1 + 12 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 8 | 0) >> 2] = $6_1;
      break label$110;
     }
     $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
     HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
     HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
     HEAP32[($6_1 + 24 | 0) >> 2] = 0;
     HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
     HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
    }
    $0_1 = $8_1 + 8 | 0;
    break label$1;
   }
   label$120 : {
    if (!$10_1) {
     break label$120
    }
    label$121 : {
     label$122 : {
      $5_1 = HEAP32[($6_1 + 28 | 0) >> 2] | 0;
      $0_1 = ($5_1 << 2 | 0) + 2436 | 0;
      if (($6_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
       break label$122
      }
      HEAP32[$0_1 >> 2] = $8_1;
      if ($8_1) {
       break label$121
      }
      HEAP32[(0 + 2136 | 0) >> 2] = $9_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
      break label$120;
     }
     HEAP32[($10_1 + ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) == ($6_1 | 0) ? 16 : 20) | 0) >> 2] = $8_1;
     if (!$8_1) {
      break label$120
     }
    }
    HEAP32[($8_1 + 24 | 0) >> 2] = $10_1;
    label$123 : {
     $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
     if (!$0_1) {
      break label$123
     }
     HEAP32[($8_1 + 16 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $8_1;
    }
    $0_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
    if (!$0_1) {
     break label$120
    }
    HEAP32[($8_1 + 20 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 24 | 0) >> 2] = $8_1;
   }
   label$124 : {
    label$125 : {
     if ($4_1 >>> 0 > 15 >>> 0) {
      break label$125
     }
     $0_1 = $4_1 + $3_1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
     $0_1 = $6_1 + $0_1 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     break label$124;
    }
    HEAP32[($6_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
    $5_1 = $6_1 + $3_1 | 0;
    HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
    HEAP32[($5_1 + $4_1 | 0) >> 2] = $4_1;
    label$126 : {
     if (!$7_1) {
      break label$126
     }
     $8_1 = $7_1 >>> 3 | 0;
     $3_1 = ($8_1 << 3 | 0) + 2172 | 0;
     $0_1 = HEAP32[(0 + 2152 | 0) >> 2] | 0;
     label$127 : {
      label$128 : {
       $8_1 = 1 << $8_1 | 0;
       if ($8_1 & $2_1 | 0) {
        break label$128
       }
       HEAP32[(0 + 2132 | 0) >> 2] = $8_1 | $2_1 | 0;
       $8_1 = $3_1;
       break label$127;
      }
      $8_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
     HEAP32[($8_1 + 12 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
     HEAP32[($0_1 + 8 | 0) >> 2] = $8_1;
    }
    HEAP32[(0 + 2152 | 0) >> 2] = $5_1;
    HEAP32[(0 + 2140 | 0) >> 2] = $4_1;
   }
   $0_1 = $6_1 + 8 | 0;
  }
  global$0 = $1_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $50() {
  return __wasm_memory_size() << 16 | 0 | 0;
 }
 
 function $51($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = HEAP32[(0 + 1788 | 0) >> 2] | 0;
  $2_1 = ($0_1 + 3 | 0) & -4 | 0;
  $0_1 = $1_1 + $2_1 | 0;
  label$1 : {
   label$2 : {
    if (!$2_1) {
     break label$2
    }
    if ($0_1 >>> 0 <= $1_1 >>> 0) {
     break label$1
    }
   }
   label$3 : {
    if ($0_1 >>> 0 <= ($50() | 0) >>> 0) {
     break label$3
    }
    if (!(fimport$2($0_1 | 0) | 0)) {
     break label$1
    }
   }
   HEAP32[(0 + 1788 | 0) >> 2] = $0_1;
   return $1_1 | 0;
  }
  HEAP32[($13() | 0) >> 2] = 48;
  return -1 | 0;
 }
 
 function $52($0_1) {
  $0_1 = $0_1 | 0;
  return 1 | 0;
 }
 
 function $53($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $54($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $55($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $56() {
  $54(2628 | 0);
  return 2632 | 0;
 }
 
 function $57() {
  $55(2628 | 0);
 }
 
 function $58($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = HEAP32[($0_1 + 72 | 0) >> 2] | 0;
  HEAP32[($0_1 + 72 | 0) >> 2] = $1_1 + -1 | 0 | $1_1 | 0;
  label$1 : {
   $1_1 = HEAP32[$0_1 >> 2] | 0;
   if (!($1_1 & 8 | 0)) {
    break label$1
   }
   HEAP32[$0_1 >> 2] = $1_1 | 32 | 0;
   return -1 | 0;
  }
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = 0;
  $1_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
  HEAP32[($0_1 + 28 | 0) >> 2] = $1_1;
  HEAP32[($0_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($0_1 + 16 | 0) >> 2] = $1_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
  return 0 | 0;
 }
 
 function $59($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0;
  label$1 : {
   if ($2_1 >>> 0 < 512 >>> 0) {
    break label$1
   }
   fimport$3($0_1 | 0, $1_1 | 0, $2_1 | 0) | 0;
   return $0_1 | 0;
  }
  $3_1 = $0_1 + $2_1 | 0;
  label$2 : {
   label$3 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if ($0_1 & 3 | 0) {
       break label$5
      }
      $2_1 = $0_1;
      break label$4;
     }
     label$6 : {
      if ($2_1) {
       break label$6
      }
      $2_1 = $0_1;
      break label$4;
     }
     $2_1 = $0_1;
     label$7 : while (1) {
      HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
      $1_1 = $1_1 + 1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if (!($2_1 & 3 | 0)) {
       break label$4
      }
      if ($2_1 >>> 0 < $3_1 >>> 0) {
       continue label$7
      }
      break label$7;
     };
    }
    label$8 : {
     $4_1 = $3_1 & -4 | 0;
     if ($4_1 >>> 0 < 64 >>> 0) {
      break label$8
     }
     $5_1 = $4_1 + -64 | 0;
     if ($2_1 >>> 0 > $5_1 >>> 0) {
      break label$8
     }
     label$9 : while (1) {
      HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
      HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
      HEAP32[($2_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
      HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
      HEAP32[($2_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      HEAP32[($2_1 + 24 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
      HEAP32[($2_1 + 32 | 0) >> 2] = HEAP32[($1_1 + 32 | 0) >> 2] | 0;
      HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[($1_1 + 36 | 0) >> 2] | 0;
      HEAP32[($2_1 + 40 | 0) >> 2] = HEAP32[($1_1 + 40 | 0) >> 2] | 0;
      HEAP32[($2_1 + 44 | 0) >> 2] = HEAP32[($1_1 + 44 | 0) >> 2] | 0;
      HEAP32[($2_1 + 48 | 0) >> 2] = HEAP32[($1_1 + 48 | 0) >> 2] | 0;
      HEAP32[($2_1 + 52 | 0) >> 2] = HEAP32[($1_1 + 52 | 0) >> 2] | 0;
      HEAP32[($2_1 + 56 | 0) >> 2] = HEAP32[($1_1 + 56 | 0) >> 2] | 0;
      HEAP32[($2_1 + 60 | 0) >> 2] = HEAP32[($1_1 + 60 | 0) >> 2] | 0;
      $1_1 = $1_1 + 64 | 0;
      $2_1 = $2_1 + 64 | 0;
      if ($2_1 >>> 0 <= $5_1 >>> 0) {
       continue label$9
      }
      break label$9;
     };
    }
    if ($2_1 >>> 0 >= $4_1 >>> 0) {
     break label$2
    }
    label$10 : while (1) {
     HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 + 4 | 0;
     $2_1 = $2_1 + 4 | 0;
     if ($2_1 >>> 0 < $4_1 >>> 0) {
      continue label$10
     }
     break label$2;
    };
   }
   label$11 : {
    if ($3_1 >>> 0 >= 4 >>> 0) {
     break label$11
    }
    $2_1 = $0_1;
    break label$2;
   }
   label$12 : {
    $4_1 = $3_1 + -4 | 0;
    if ($4_1 >>> 0 >= $0_1 >>> 0) {
     break label$12
    }
    $2_1 = $0_1;
    break label$2;
   }
   $2_1 = $0_1;
   label$13 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    HEAP8[($2_1 + 1 | 0) >> 0] = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($2_1 + 2 | 0) >> 0] = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
    HEAP8[($2_1 + 3 | 0) >> 0] = HEAPU8[($1_1 + 3 | 0) >> 0] | 0;
    $1_1 = $1_1 + 4 | 0;
    $2_1 = $2_1 + 4 | 0;
    if ($2_1 >>> 0 <= $4_1 >>> 0) {
     continue label$13
    }
    break label$13;
   };
  }
  label$14 : {
   if ($2_1 >>> 0 >= $3_1 >>> 0) {
    break label$14
   }
   label$15 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + 1 | 0;
    if (($2_1 | 0) != ($3_1 | 0)) {
     continue label$15
    }
    break label$15;
   };
  }
  return $0_1 | 0;
 }
 
 function $60($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0, $4_1 = 0, i64toi32_i32$1 = 0, $6_1 = 0, $5_1 = 0, $6$hi = 0;
  label$1 : {
   if (!$2_1) {
    break label$1
   }
   HEAP8[$0_1 >> 0] = $1_1;
   $3_1 = $2_1 + $0_1 | 0;
   HEAP8[($3_1 + -1 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 3 >>> 0) {
    break label$1
   }
   HEAP8[($0_1 + 2 | 0) >> 0] = $1_1;
   HEAP8[($0_1 + 1 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -3 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -2 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 7 >>> 0) {
    break label$1
   }
   HEAP8[($0_1 + 3 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -4 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 9 >>> 0) {
    break label$1
   }
   $4_1 = (0 - $0_1 | 0) & 3 | 0;
   $3_1 = $0_1 + $4_1 | 0;
   $1_1 = Math_imul($1_1 & 255 | 0, 16843009);
   HEAP32[$3_1 >> 2] = $1_1;
   $4_1 = ($2_1 - $4_1 | 0) & -4 | 0;
   $2_1 = $3_1 + $4_1 | 0;
   HEAP32[($2_1 + -4 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 9 >>> 0) {
    break label$1
   }
   HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 4 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -8 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -12 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 25 >>> 0) {
    break label$1
   }
   HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 16 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 12 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -16 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -20 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -24 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -28 | 0) >> 2] = $1_1;
   $5_1 = $3_1 & 4 | 0 | 24 | 0;
   $2_1 = $4_1 - $5_1 | 0;
   if ($2_1 >>> 0 < 32 >>> 0) {
    break label$1
   }
   i64toi32_i32$0 = 0;
   i64toi32_i32$1 = 1;
   i64toi32_i32$1 = __wasm_i64_mul($1_1 | 0, i64toi32_i32$0 | 0, 1 | 0, i64toi32_i32$1 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   $6_1 = i64toi32_i32$1;
   $6$hi = i64toi32_i32$0;
   $1_1 = $3_1 + $5_1 | 0;
   label$2 : while (1) {
    i64toi32_i32$0 = $6$hi;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 24 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 28 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 16 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 20 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 12 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[$1_1 >> 2] = $6_1;
    HEAP32[($1_1 + 4 | 0) >> 2] = i64toi32_i32$0;
    $1_1 = $1_1 + 32 | 0;
    $2_1 = $2_1 + -32 | 0;
    if ($2_1 >>> 0 > 31 >>> 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $0_1 | 0;
 }
 
 function $61($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0;
  label$1 : {
   label$2 : {
    $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
    if ($3_1) {
     break label$2
    }
    $4_1 = 0;
    if ($58($2_1 | 0) | 0) {
     break label$1
    }
    $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
   }
   label$3 : {
    $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
    if (($3_1 - $5_1 | 0) >>> 0 >= $1_1 >>> 0) {
     break label$3
    }
    return FUNCTION_TABLE[HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0]($2_1, $0_1, $1_1) | 0 | 0;
   }
   label$4 : {
    label$5 : {
     if ((HEAP32[($2_1 + 80 | 0) >> 2] | 0 | 0) >= (0 | 0)) {
      break label$5
     }
     $3_1 = 0;
     break label$4;
    }
    $4_1 = $1_1;
    label$6 : while (1) {
     label$7 : {
      $3_1 = $4_1;
      if ($3_1) {
       break label$7
      }
      $3_1 = 0;
      break label$4;
     }
     $4_1 = $3_1 + -1 | 0;
     if ((HEAPU8[($0_1 + $4_1 | 0) >> 0] | 0 | 0) != (10 | 0)) {
      continue label$6
     }
     break label$6;
    };
    $4_1 = FUNCTION_TABLE[HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0]($2_1, $0_1, $3_1) | 0;
    if ($4_1 >>> 0 < $3_1 >>> 0) {
     break label$1
    }
    $0_1 = $0_1 + $3_1 | 0;
    $1_1 = $1_1 - $3_1 | 0;
    $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
   }
   $59($5_1 | 0, $0_1 | 0, $1_1 | 0) | 0;
   HEAP32[($2_1 + 20 | 0) >> 2] = (HEAP32[($2_1 + 20 | 0) >> 2] | 0) + $1_1 | 0;
   $4_1 = $3_1 + $1_1 | 0;
  }
  return $4_1 | 0;
 }
 
 function $62($0_1) {
  $0_1 = $0_1 | 0;
  return 0 | 0;
 }
 
 function $63($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  i64toi32_i32$HIGH_BITS = 0;
  return 0 | 0;
 }
 
 function $64($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $3_1 = 0;
  $1_1 = $0_1;
  label$1 : {
   label$2 : {
    if (!($1_1 & 3 | 0)) {
     break label$2
    }
    $1_1 = $0_1;
    label$3 : while (1) {
     if (!(HEAPU8[$1_1 >> 0] | 0)) {
      break label$1
     }
     $1_1 = $1_1 + 1 | 0;
     if ($1_1 & 3 | 0) {
      continue label$3
     }
     break label$3;
    };
   }
   label$4 : while (1) {
    $2_1 = $1_1;
    $1_1 = $1_1 + 4 | 0;
    $3_1 = HEAP32[$2_1 >> 2] | 0;
    if (!((($3_1 ^ -1 | 0) & ($3_1 + -16843009 | 0) | 0) & -2139062144 | 0)) {
     continue label$4
    }
    break label$4;
   };
   label$5 : {
    if ($3_1 & 255 | 0) {
     break label$5
    }
    return $2_1 - $0_1 | 0 | 0;
   }
   label$6 : while (1) {
    $3_1 = HEAPU8[($2_1 + 1 | 0) >> 0] | 0;
    $1_1 = $2_1 + 1 | 0;
    $2_1 = $1_1;
    if ($3_1) {
     continue label$6
    }
    break label$6;
   };
  }
  return $1_1 - $0_1 | 0 | 0;
 }
 
 function $65() {
  return global$0 | 0;
 }
 
 function $66($0_1) {
  $0_1 = $0_1 | 0;
  global$0 = $0_1;
 }
 
 function $67($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = (global$0 - $0_1 | 0) & -16 | 0;
  global$0 = $1_1;
  return $1_1 | 0;
 }
 
 function $68() {
  global$2 = 5246560;
  global$1 = (3672 + 15 | 0) & -16 | 0;
 }
 
 function $69() {
  return global$0 - global$1 | 0 | 0;
 }
 
 function $70() {
  return global$1 | 0;
 }
 
 function $71($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$1 = 0, $2_1 = 0, i64toi32_i32$0 = 0, $3_1 = 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   $1_1 = 0;
   label$2 : {
    if (!(HEAP32[(0 + 1936 | 0) >> 2] | 0)) {
     break label$2
    }
    $1_1 = $71(HEAP32[(0 + 1936 | 0) >> 2] | 0 | 0) | 0;
   }
   label$3 : {
    if (!(HEAP32[(0 + 1784 | 0) >> 2] | 0)) {
     break label$3
    }
    $1_1 = $71(HEAP32[(0 + 1784 | 0) >> 2] | 0 | 0) | 0 | $1_1 | 0;
   }
   label$4 : {
    $0_1 = HEAP32[($56() | 0) >> 2] | 0;
    if (!$0_1) {
     break label$4
    }
    label$5 : while (1) {
     $2_1 = 0;
     label$6 : {
      if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
       break label$6
      }
      $2_1 = $52($0_1 | 0) | 0;
     }
     label$7 : {
      if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
       break label$7
      }
      $1_1 = $71($0_1 | 0) | 0 | $1_1 | 0;
     }
     label$8 : {
      if (!$2_1) {
       break label$8
      }
      $53($0_1 | 0);
     }
     $0_1 = HEAP32[($0_1 + 56 | 0) >> 2] | 0;
     if ($0_1) {
      continue label$5
     }
     break label$5;
    };
   }
   $57();
   return $1_1 | 0;
  }
  $2_1 = 0;
  label$9 : {
   if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
    break label$9
   }
   $2_1 = $52($0_1 | 0) | 0;
  }
  label$10 : {
   label$11 : {
    label$12 : {
     if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
      break label$12
     }
     FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
     if (HEAP32[($0_1 + 20 | 0) >> 2] | 0) {
      break label$12
     }
     $1_1 = -1;
     if ($2_1) {
      break label$11
     }
     break label$10;
    }
    label$13 : {
     $1_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
     $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
     if (($1_1 | 0) == ($3_1 | 0)) {
      break label$13
     }
     i64toi32_i32$1 = $1_1 - $3_1 | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     i64toi32_i32$0 = FUNCTION_TABLE[HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0]($0_1, i64toi32_i32$1, i64toi32_i32$0, 1) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    }
    $1_1 = 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = 0;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$1 = 0;
    HEAP32[($0_1 + 16 | 0) >> 2] = 0;
    HEAP32[($0_1 + 20 | 0) >> 2] = i64toi32_i32$1;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$1 = 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = 0;
    HEAP32[($0_1 + 8 | 0) >> 2] = i64toi32_i32$1;
    if (!$2_1) {
     break label$10
    }
   }
   $53($0_1 | 0);
  }
  return $1_1 | 0;
 }
 
 function $72($0_1, $1_1, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$0 = FUNCTION_TABLE[$0_1 | 0]($1_1, $2_1, i64toi32_i32$0, $3_1) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $73($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $17_1 = 0, $18_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $9$hi = 0, $12$hi = 0, $5_1 = 0, $5$hi = 0;
  $6_1 = $0_1;
  $7_1 = $1_1;
  i64toi32_i32$0 = 0;
  $9_1 = $2_1;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $17_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $17_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$0 = $9_1;
  i64toi32_i32$2 = $12$hi;
  i64toi32_i32$3 = $17_1;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  i64toi32_i32$2 = $72($6_1 | 0, $7_1 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0, i64toi32_i32$2 | 0, $4_1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $5_1 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  fimport$4($18_1 | 0);
  i64toi32_i32$2 = $5$hi;
  return $5_1 | 0;
 }
 
 function $74($0_1, $1_1, $1$hi, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $12_1 = 0, $4_1 = 0, $6_1 = 0, i64toi32_i32$2 = 0;
  $4_1 = $0_1;
  i64toi32_i32$0 = $1$hi;
  $6_1 = $1_1;
  i64toi32_i32$2 = $1_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $12_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $12_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  return fimport$5($4_1 | 0, $6_1 | 0, $12_1 | 0, $2_1 | 0, $3_1 | 0) | 0 | 0;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21_1 = 0, $22_1 = 0, var$6 = 0, $24_1 = 0, $17_1 = 0, $18_1 = 0, $23_1 = 0, $29_1 = 0, $45_1 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17_1 = Math_imul(var$4, var$5);
  $18_1 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23_1 = $17_1 + Math_imul($18_1, $21_1) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29_1 = $23_1 + Math_imul($22_1, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45_1 = $29_1 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45_1 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24_1;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, var$2 = 0, var$3 = 0, var$4 = 0, var$5 = 0, var$5$hi = 0, var$6 = 0, var$6$hi = 0, i64toi32_i32$6 = 0, $37_1 = 0, $38_1 = 0, $39_1 = 0, $40_1 = 0, $41_1 = 0, $42_1 = 0, $43_1 = 0, $44_1 = 0, var$8$hi = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, var$7$hi = 0, $49_1 = 0, $63$hi = 0, $65_1 = 0, $65$hi = 0, $120$hi = 0, $129$hi = 0, $134$hi = 0, var$8 = 0, $140 = 0, $140$hi = 0, $142$hi = 0, $144 = 0, $144$hi = 0, $151 = 0, $151$hi = 0, $154$hi = 0, var$7 = 0, $165$hi = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             i64toi32_i32$0 = var$0$hi;
             i64toi32_i32$2 = var$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$3 = 32;
             i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
             if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
              i64toi32_i32$1 = 0;
              $37_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
             } else {
              i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
              $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
             }
             var$2 = $37_1;
             if (var$2) {
              block : {
               i64toi32_i32$1 = var$1$hi;
               var$3 = var$1;
               if (!var$3) {
                break label$11
               }
               i64toi32_i32$1 = var$1$hi;
               i64toi32_i32$0 = var$1;
               i64toi32_i32$2 = 0;
               i64toi32_i32$3 = 32;
               i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
               if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
                i64toi32_i32$2 = 0;
                $38_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
               } else {
                i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
                $38_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
               }
               var$4 = $38_1;
               if (!var$4) {
                break label$9
               }
               var$2 = Math_clz32(var$4) - Math_clz32(var$2) | 0;
               if (var$2 >>> 0 <= 31 >>> 0) {
                break label$8
               }
               break label$2;
              }
             }
             i64toi32_i32$2 = var$1$hi;
             i64toi32_i32$1 = var$1;
             i64toi32_i32$0 = 1;
             i64toi32_i32$3 = 0;
             if (i64toi32_i32$2 >>> 0 > i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
              break label$2
             }
             i64toi32_i32$1 = var$0$hi;
             var$2 = var$0;
             i64toi32_i32$1 = var$1$hi;
             var$3 = var$1;
             var$2 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
             i64toi32_i32$1 = 0;
             __wasm_intrinsics_temp_i64 = var$0 - Math_imul(var$2, var$3) | 0;
             __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
             i64toi32_i32$1 = 0;
             i64toi32_i32$2 = var$2;
             i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
             return i64toi32_i32$2 | 0;
            }
            i64toi32_i32$2 = var$1$hi;
            i64toi32_i32$3 = var$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$1 = 0;
             $39_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
            } else {
             i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
             $39_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
            }
            var$3 = $39_1;
            i64toi32_i32$1 = var$0$hi;
            if (!var$0) {
             break label$7
            }
            if (!var$3) {
             break label$6
            }
            var$4 = var$3 + -1 | 0;
            if (var$4 & var$3 | 0) {
             break label$6
            }
            i64toi32_i32$1 = 0;
            i64toi32_i32$2 = var$4 & var$2 | 0;
            i64toi32_i32$3 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$3 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
             $40_1 = 0;
            } else {
             i64toi32_i32$3 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
             $40_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
            }
            $63$hi = i64toi32_i32$3;
            i64toi32_i32$3 = var$0$hi;
            i64toi32_i32$1 = var$0;
            i64toi32_i32$2 = 0;
            i64toi32_i32$0 = -1;
            i64toi32_i32$2 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
            $65_1 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
            $65$hi = i64toi32_i32$2;
            i64toi32_i32$2 = $63$hi;
            i64toi32_i32$3 = $40_1;
            i64toi32_i32$1 = $65$hi;
            i64toi32_i32$0 = $65_1;
            i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
            __wasm_intrinsics_temp_i64 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
            __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$3 = var$2 >>> ((__wasm_ctz_i32(var$3 | 0) | 0) & 31 | 0) | 0;
            i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
            return i64toi32_i32$3 | 0;
           }
          }
          var$4 = var$3 + -1 | 0;
          if (!(var$4 & var$3 | 0)) {
           break label$5
          }
          var$2 = (Math_clz32(var$3) + 33 | 0) - Math_clz32(var$2) | 0;
          var$3 = 0 - var$2 | 0;
          break label$3;
         }
         var$3 = 63 - var$2 | 0;
         var$2 = var$2 + 1 | 0;
         break label$3;
        }
        var$4 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
        i64toi32_i32$3 = 0;
        i64toi32_i32$2 = var$2 - Math_imul(var$4, var$3) | 0;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 32;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
         $41_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $41_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
        }
        __wasm_intrinsics_temp_i64 = $41_1;
        __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 0;
        i64toi32_i32$2 = var$4;
        i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
        return i64toi32_i32$2 | 0;
       }
       var$2 = Math_clz32(var$3) - Math_clz32(var$2) | 0;
       if (var$2 >>> 0 < 31 >>> 0) {
        break label$4
       }
       break label$2;
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      __wasm_intrinsics_temp_i64 = var$4 & var$0 | 0;
      __wasm_intrinsics_temp_i64$hi = i64toi32_i32$2;
      if ((var$3 | 0) == (1 | 0)) {
       break label$1
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      $120$hi = i64toi32_i32$2;
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$3 = var$0;
      i64toi32_i32$1 = $120$hi;
      i64toi32_i32$0 = __wasm_ctz_i32(var$3 | 0) | 0;
      i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
       i64toi32_i32$1 = 0;
       $42_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
       $42_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
      }
      i64toi32_i32$3 = $42_1;
      i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
      return i64toi32_i32$3 | 0;
     }
     var$3 = 63 - var$2 | 0;
     var$2 = var$2 + 1 | 0;
    }
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$3 = 0;
    $129$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$2 = var$0;
    i64toi32_i32$1 = $129$hi;
    i64toi32_i32$0 = var$2 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $43_1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
     $43_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    var$5 = $43_1;
    var$5$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$1 = 0;
    $134$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$3 = var$0;
    i64toi32_i32$2 = $134$hi;
    i64toi32_i32$0 = var$3 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
     $44_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $44_1 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
    }
    var$0 = $44_1;
    var$0$hi = i64toi32_i32$2;
    label$13 : {
     if (var$2) {
      block3 : {
       i64toi32_i32$2 = var$1$hi;
       i64toi32_i32$1 = var$1;
       i64toi32_i32$3 = -1;
       i64toi32_i32$0 = -1;
       i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
       i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
       if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
        i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
       }
       var$8 = i64toi32_i32$4;
       var$8$hi = i64toi32_i32$5;
       label$15 : while (1) {
        i64toi32_i32$5 = var$5$hi;
        i64toi32_i32$2 = var$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
         $45_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
         $45_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
        }
        $140 = $45_1;
        $140$hi = i64toi32_i32$1;
        i64toi32_i32$1 = var$0$hi;
        i64toi32_i32$5 = var$0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 63;
        i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = 0;
         $46_1 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
        } else {
         i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
         $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$3 | 0) | 0;
        }
        $142$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $140$hi;
        i64toi32_i32$1 = $140;
        i64toi32_i32$5 = $142$hi;
        i64toi32_i32$0 = $46_1;
        i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
        var$5 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
        var$5$hi = i64toi32_i32$5;
        $144 = var$5;
        $144$hi = i64toi32_i32$5;
        i64toi32_i32$5 = var$8$hi;
        i64toi32_i32$5 = var$5$hi;
        i64toi32_i32$5 = var$8$hi;
        i64toi32_i32$2 = var$8;
        i64toi32_i32$1 = var$5$hi;
        i64toi32_i32$0 = var$5;
        i64toi32_i32$3 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
        i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
        i64toi32_i32$4 = i64toi32_i32$6 + i64toi32_i32$1 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
        i64toi32_i32$5 = i64toi32_i32$3;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 63;
        i64toi32_i32$1 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = i64toi32_i32$4 >> 31 | 0;
         $47_1 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
        } else {
         i64toi32_i32$2 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
         $47_1 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$1 | 0) | 0;
        }
        var$6 = $47_1;
        var$6$hi = i64toi32_i32$2;
        i64toi32_i32$2 = var$1$hi;
        i64toi32_i32$2 = var$6$hi;
        i64toi32_i32$4 = var$6;
        i64toi32_i32$5 = var$1$hi;
        i64toi32_i32$0 = var$1;
        i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
        $151 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
        $151$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $144$hi;
        i64toi32_i32$2 = $144;
        i64toi32_i32$4 = $151$hi;
        i64toi32_i32$0 = $151;
        i64toi32_i32$1 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
        i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
        i64toi32_i32$3 = i64toi32_i32$6 + i64toi32_i32$4 | 0;
        i64toi32_i32$3 = i64toi32_i32$5 - i64toi32_i32$3 | 0;
        var$5 = i64toi32_i32$1;
        var$5$hi = i64toi32_i32$3;
        i64toi32_i32$3 = var$0$hi;
        i64toi32_i32$5 = var$0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
         $48_1 = 0;
        } else {
         i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $48_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
        }
        $154$hi = i64toi32_i32$2;
        i64toi32_i32$2 = var$7$hi;
        i64toi32_i32$2 = $154$hi;
        i64toi32_i32$3 = $48_1;
        i64toi32_i32$5 = var$7$hi;
        i64toi32_i32$0 = var$7;
        i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
        var$0 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
        var$0$hi = i64toi32_i32$5;
        i64toi32_i32$5 = var$6$hi;
        i64toi32_i32$2 = var$6;
        i64toi32_i32$3 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$3 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
        var$6 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
        var$6$hi = i64toi32_i32$3;
        var$7 = var$6;
        var$7$hi = i64toi32_i32$3;
        var$2 = var$2 + -1 | 0;
        if (var$2) {
         continue label$15
        }
        break label$15;
       };
       break label$13;
      }
     }
    }
    i64toi32_i32$3 = var$5$hi;
    __wasm_intrinsics_temp_i64 = var$5;
    __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$5 = var$0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$0 = 1;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
     $49_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
     $49_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
    }
    $165$hi = i64toi32_i32$2;
    i64toi32_i32$2 = var$6$hi;
    i64toi32_i32$2 = $165$hi;
    i64toi32_i32$3 = $49_1;
    i64toi32_i32$5 = var$6$hi;
    i64toi32_i32$0 = var$6;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    i64toi32_i32$3 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
    i64toi32_i32$HIGH_BITS = i64toi32_i32$5;
    return i64toi32_i32$3 | 0;
   }
   i64toi32_i32$3 = var$0$hi;
   __wasm_intrinsics_temp_i64 = var$0;
   __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   var$0 = 0;
   var$0$hi = i64toi32_i32$3;
  }
  i64toi32_i32$3 = var$0$hi;
  i64toi32_i32$5 = var$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$3;
  return i64toi32_i32$5 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_i64_udiv(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 function __wasm_ctz_i32(var$0) {
  var$0 = var$0 | 0;
  if (var$0) {
   return 31 - Math_clz32((var$0 + -1 | 0) ^ var$0 | 0) | 0 | 0
  }
  return 32 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 initActiveSegments(env);
 var FUNCTION_TABLE = Table([null, $28, $29, $32, $35, $37, $39, $62, $63]);
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
 }
 
 return {
  "__wasm_call_ctors": $0, 
  "encrypt": $4, 
  "__indirect_function_table": FUNCTION_TABLE, 
  "__errno_location": $13, 
  "fflush": $71, 
  "emscripten_stack_init": $68, 
  "emscripten_stack_get_free": $69, 
  "emscripten_stack_get_end": $70, 
  "stackSave": $65, 
  "stackRestore": $66, 
  "stackAlloc": $67, 
  "dynCall_jiji": $73
 };
}

  return asmFunc(asmLibraryArg);
}

)(asmLibraryArg);
  },

  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          'instance': new WebAssembly.Instance(module)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return { catch: function() {} };
      }
    };
  },

  RuntimeError: Error
};

// We don't need to actually download a wasm binary, mark it as present but empty.
wasmBinary = [];

// end include: wasm2js.js
if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return Number(HEAPF64[((ptr)>>3)]);
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }

  ret = onDone(ret);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
function _malloc() {
  abort("malloc() called but not included in the build - add '_malloc' to EXPORTED_FUNCTIONS");
}
function _free() {
  // Show a helpful error since we used to include free by default in the past.
  abort("free() called but not included in the build - add '_free' to EXPORTED_FUNCTIONS");
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument')
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0')

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = abort('malloc was not included, but is needed in allocate. Adding "_malloc" to EXPORTED_FUNCTIONS should fix that. This may be a bug in the compiler, please file an issue.');;
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  ;
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 0x10FFFF) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = abort('malloc was not included, but is needed in allocateUTF8. Adding "_malloc" to EXPORTED_FUNCTIONS should fix that. This may be a bug in the compiler, please file an issue.');;
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === (str.charCodeAt(i) & 0xff));
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) {
  Object.defineProperty(Module, 'INITIAL_MEMORY', {
    configurable: true,
    get: function() {
      abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js


// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_MEMORY / 65536,
      'maximum': INITIAL_MEMORY / 65536
    });
  }

if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['INITIAL_MEMORY'].
INITIAL_MEMORY = buffer.byteLength;
assert(INITIAL_MEMORY % 65536 === 0);
updateGlobalBufferAndViews(buffer);

// end include: runtime_init_memory.js

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAP32[((max + 4)>>2)] = 0x2135467;
  HEAP32[((max + 8)>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[((max + 4)>>2)];
  var cookie2 = HEAPU32[((max + 8)>>2)];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' 0x' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -s SUPPORT_BIG_ENDIAN=1 to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;
var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
  return noExitRuntime || runtimeKeepaliveCounter > 0;
}

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  
  callRuntimeCallbacks(__ATINIT__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  {
    if (Module['onAbort']) {
      Module['onAbort'](what);
    }
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

var wasmBinaryFile;
  wasmBinaryFile = 'mmm.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }

  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    Module['asm'] = exports;

    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(function (instance) {
      return instance;
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);

      // Warn on some common problems.
      if (isFileURI(wasmBinaryFile)) {
        err('warning: Loading from a file URI (' + wasmBinaryFile + ') is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing');
      }
      abort(reason);
    });
  }

  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);

        return result.then(
          receiveInstantiationResult,
          function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};






  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            getWasmTableEntry(func)();
          } else {
            getWasmTableEntry(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function withStackSave(f) {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    }
  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  var wasmTableMirror = [];
  function getWasmTableEntry(funcPtr) {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
      return func;
    }

  function handleException(e) {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      quit_(1, e);
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  function setWasmTableEntry(idx, func) {
      wasmTable.set(idx, func);
      wasmTableMirror[idx] = func;
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s INITIAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      abortOnCannotGrowMemory(requestedSize);
    }

  var SYSCALLS = {mappings:{},buffers:[null,[],[]],printChar:function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:undefined,get:function() {
        assert(SYSCALLS.varargs != undefined);
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },get64:function(low, high) {
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      }};
  function _fd_close(fd) {
      abort('it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM');
      return 0;
    }

  function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
  abort('it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM');
  }

  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      if (typeof _fflush !== 'undefined') _fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  function _fd_write(fd, iov, iovcnt, pnum) {
      ;
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[((iov)>>2)];
        var len = HEAP32[(((iov)+(4))>>2)];
        iov += 8;
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAP32[((pnum)>>2)] = num;
      return 0;
    }

  function _setTempRet0(val) {
      setTempRet0(val);
    }
var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, 'base64');
    return new Uint8Array(buf['buffer'], buf['byteOffset'], buf['byteLength']);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "fd_close": _fd_close,
  "fd_seek": _fd_seek,
  "fd_write": _fd_write,
  "getTempRet0": getTempRet0,
  "memory": wasmMemory,
  "setTempRet0": setTempRet0
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");

/** @type {function(...*):?} */
var _encrypt = Module["_encrypt"] = createExportWrapper("encrypt");

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");

/** @type {function(...*):?} */
var _fflush = Module["_fflush"] = createExportWrapper("fflush");

/** @type {function(...*):?} */
var _emscripten_stack_init = Module["_emscripten_stack_init"] = function() {
  return (_emscripten_stack_init = Module["_emscripten_stack_init"] = Module["asm"]["emscripten_stack_init"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
  return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave");

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");

/** @type {function(...*):?} */
var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji");





// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["cwrap"] = cwrap;
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "keepRuntimeAlive")) Module["keepRuntimeAlive"] = function() { abort("'keepRuntimeAlive' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "zeroMemory")) Module["zeroMemory"] = function() { abort("'zeroMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abortOnCannotGrowMemory")) Module["abortOnCannotGrowMemory"] = function() { abort("'abortOnCannotGrowMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "withStackSave")) Module["withStackSave"] = function() { abort("'withStackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton4")) Module["inetPton4"] = function() { abort("'inetPton4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop4")) Module["inetNtop4"] = function() { abort("'inetNtop4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton6")) Module["inetPton6"] = function() { abort("'inetPton6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop6")) Module["inetNtop6"] = function() { abort("'inetNtop6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readSockaddr")) Module["readSockaddr"] = function() { abort("'readSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeSockaddr")) Module["writeSockaddr"] = function() { abort("'writeSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertFrameToPC")) Module["convertFrameToPC"] = function() { abort("'convertFrameToPC' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "saveInUnwindCache")) Module["saveInUnwindCache"] = function() { abort("'saveInUnwindCache' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertPCtoSourceLocation")) Module["convertPCtoSourceLocation"] = function() { abort("'convertPCtoSourceLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wasmTableMirror")) Module["wasmTableMirror"] = function() { abort("'wasmTableMirror' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setWasmTableEntry")) Module["setWasmTableEntry"] = function() { abort("'setWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getWasmTableEntry")) Module["getWasmTableEntry"] = function() { abort("'getWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "handleException")) Module["handleException"] = function() { abort("'handleException' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePush")) Module["runtimeKeepalivePush"] = function() { abort("'runtimeKeepalivePush' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePop")) Module["runtimeKeepalivePop"] = function() { abort("'runtimeKeepalivePop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callUserCallback")) Module["callUserCallback"] = function() { abort("'callUserCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeExit")) Module["maybeExit"] = function() { abort("'maybeExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "safeSetTimeout")) Module["safeSetTimeout"] = function() { abort("'safeSetTimeout' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asmjsMangle")) Module["asmjsMangle"] = function() { abort("'asmjsMangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asyncLoad")) Module["asyncLoad"] = function() { abort("'asyncLoad' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignMemory")) Module["alignMemory"] = function() { abort("'alignMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mmapAlloc")) Module["mmapAlloc"] = function() { abort("'mmapAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketFromFD")) Module["getSocketFromFD"] = function() { abort("'getSocketFromFD' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketAddress")) Module["getSocketAddress"] = function() { abort("'getSocketAddress' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "flush_NO_FILESYSTEM")) Module["flush_NO_FILESYSTEM"] = function() { abort("'flush_NO_FILESYSTEM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setImmediateWrapped")) Module["setImmediateWrapped"] = function() { abort("'setImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "clearImmediateWrapped")) Module["clearImmediateWrapped"] = function() { abort("'clearImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wget")) Module["wget"] = function() { abort("'wget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "MEMFS")) Module["MEMFS"] = function() { abort("'MEMFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "TTY")) Module["TTY"] = function() { abort("'TTY' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PIPEFS")) Module["PIPEFS"] = function() { abort("'PIPEFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SOCKFS")) Module["SOCKFS"] = function() { abort("'SOCKFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "_setNetworkCallback")) Module["_setNetworkCallback"] = function() { abort("'_setNetworkCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetUniformLocation")) Module["webglGetUniformLocation"] = function() { abort("'webglGetUniformLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglPrepareUniformLocationsBeforeFirstUse")) Module["webglPrepareUniformLocationsBeforeFirstUse"] = function() { abort("'webglPrepareUniformLocationsBeforeFirstUse' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetLeftBracePos")) Module["webglGetLeftBracePos"] = function() { abort("'webglGetLeftBracePos' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_init();
  writeStackCookie();
}

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  checkUnflushedContent();

  if (keepRuntimeAlive()) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {
    exitRuntime();
  }

  procExit(status);
}

function procExit(code) {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    if (Module['onExit']) Module['onExit'](code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();





