(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/src/a2r-hub/tree.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var EventEmitter, Node, Tree, address, _filterListAndDescendants,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require("events").EventEmitter;

  address = require("./address");

  _filterListAndDescendants = function(list, pattern) {
    var children, regexp, ret, subpath, _i, _j, _len, _len1;
    if (!list) {
      return;
    }
    ret = null;
    if (pattern) {
      regexp = pattern instanceof RegExp;
      for (_i = 0, _len = list.length; _i < _len; _i++) {
        subpath = list[_i];
        if (regexp) {
          if (pattern.test(subpath.token)) {
            ret || (ret = []);
            ret.push(subpath);
          }
        } else {
          if (pattern === subpath.token) {
            ret || (ret = []);
            ret.push(subpath);
          }
        }
        children = _filterListAndDescendants(subpath.children, pattern);
        if (children) {
          ret || (ret = []);
          ret.push.apply(ret, children);
        }
      }
    } else {
      ret = list.slice(0);
      for (_j = 0, _len1 = list.length; _j < _len1; _j++) {
        subpath = list[_j];
        children = _filterListAndDescendants(subpath.children);
        if (children) {
          ret.push.apply(ret, children);
        }
      }
    }
    return ret;
  };

  Node = (function(_super) {

    __extends(Node, _super);

    function Node(parent, token) {
      if (parent && !address.isValidToken(token)) {
        throw new Error("Invalid token `" + token + "`");
      }
      this.parent = parent;
      this.token = token;
      this.root = this._root();
      this.address = this._address();
      this.id = this.root.nextId();
      if (this.parent) {
        this.parent.addChild(this);
      }
    }

    Node.prototype._root = function() {
      var parent;
      if (!this.parent) {
        return this;
      }
      parent = this.parent;
      while (parent.parent) {
        parent = parent.parent;
      }
      return parent;
    };

    Node.prototype._address = function() {
      if (this.parent) {
        return "" + this.parent.address + "/" + this.token;
      } else {
        return "";
      }
    };

    Node.prototype.addChild = function(child) {
      if (!this.children) {
        this.children = [child];
        this.childByToken = {};
        this.childByToken[child.token] = child;
      } else {
        if (this.childByToken[child.token]) {
          throw new Error("Child with token `" + child.token + "` already exist");
        }
        this.children.push(child);
        this.childByToken[child.token] = child;
      }
      try {
        return this.root.registerAncestor(child);
      } catch (e) {
        this.removeChild(child);
        throw e;
      }
    };

    Node.prototype.removeChild = function(child) {
      var index;
      if (!this.children) {
        return false;
      }
      index = this.children.indexOf(child);
      if (index < 0) {
        return false;
      }
      delete this.childByToken[child.token];
      this.children.splice(index, 1);
      this.root.unregisterAncestor(child);
      return true;
    };

    Node.prototype.getChild = function(token) {
      var child, _i, _len, _ref, _ref1, _results;
      if (token instanceof RegExp) {
        _ref = this.children;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          if (token.test(child.token)) {
            _results.push(child);
          }
        }
        return _results;
      } else {
        return (_ref1 = this.childByToken) != null ? _ref1[token] : void 0;
      }
    };

    Node.prototype.createChild = function(token) {
      return new Node(this, token);
    };

    Node.prototype.getOrCreateChild = function(token) {
      var node;
      if ((node = this.getChild(token))) {
        return node;
      }
      return this.createChild(token);
    };

    Node.prototype.dispose = function() {
      var child, _i, _len, _ref;
      if (this.disposed) {
        return;
      }
      this.disposed = true;
      if (this.nodes) {
        _ref = this.children;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          child.dispose();
        }
      }
      this.emit("dispose", this);
      this.root.emit("node:dispose", this);
      if (this.parent) {
        this.parent.removeChild(this);
      }
      return this.removeAllListeners();
    };

    return Node;

  })(EventEmitter);

  Node.prototype.getChildren = Node.prototype.getChild;

  Tree = (function(_super) {

    __extends(Tree, _super);

    Tree.Node = Node;

    function Tree() {
      this._sequence = 1;
      this.nodes = [];
      this.nodeById = {};
      this.nodeByAddress = {};
      this.nodesByToken = {};
      Tree.__super__.constructor.call(this, null, "");
    }

    Tree.prototype.nextId = function() {
      return this._sequence++;
    };

    Tree.prototype.registerAncestor = function(node) {
      var _base, _name;
      if (this.nodeById[node.id]) {
        throw new Error("Node with id `" + node.id + "` already exist");
      }
      if (this.nodeByAddress[node.address]) {
        throw new Error("Node with address `" + node.address + "` already exist");
      }
      this.nodes.push(node);
      this.nodeById[node.id] = node;
      this.nodeByAddress[node.address] = node;
      (_base = this.nodesByToken)[_name = node.token] || (_base[_name] = []);
      this.nodesByToken[node.token].push(node);
      this.emit("node", node);
      return true;
    };

    Tree.prototype.unregisterAncestor = function(node) {
      var index;
      index = this.nodes.indexOf(node);
      if (index < 0) {
        return false;
      }
      delete this.nodeById[node.id];
      delete this.nodeByAddress[node.address];
      this.nodes.splice(index, 1);
      if (this.nodesByToken[node.token].length === 1) {
        delete this.nodesByToken[node.token];
      } else {
        index = this.nodesByToken[node.token].indexOf(node);
        if (index > -1) {
          this.nodesByToken[node.token].splice(index, 1);
        }
      }
      return true;
    };

    Tree.prototype.getNodeById = function(id) {
      return this.nodeById[id];
    };

    Tree.prototype.getNodeByAddress = function(address) {
      return this.nodeByAddress[address];
    };

    Tree.prototype.getNodesByPattern = function(pattern) {
      var child, children, i, isPattern, last, list, multilevel, node, subpath, t, token, tokens, _i, _j, _len, _len1, _ref;
      tokens = pattern.split("/");
      last = this;
      multilevel = false;
      i = 1;
      while (i < tokens.length && last) {
        token = tokens[i++];
        if (token.length === 0) {
          if (tokens.length === i) {
            if (last instanceof Node) {
              return last.children || [];
            } else {
              children = [];
              for (_i = 0, _len = last.length; _i < _len; _i++) {
                node = last[_i];
                if (node.children) {
                  children.push.apply(children, node.children);
                }
              }
              return children;
            }
          } else {
            if (last instanceof Node) {
              last = last.children;
            }
            multilevel = true;
          }
        } else {
          if ((isPattern = address.isPattern(token))) {
            token = address.compileTokenPattern(token);
          }
          if (multilevel) {
            if (i === 3) {
              if (isPattern) {
                last = [];
                _ref = this.nodesByToken;
                for (t in _ref) {
                  list = _ref[t];
                  if (token.test(t)) {
                    last.push.apply(last, list);
                  }
                }
              } else {
                last = this.nodesByToken[token];
              }
              if (!(last != null ? last.length : void 0)) {
                return [];
              }
            } else {
              last = _filterListAndDescendants(last, token);
            }
            multilevel = false;
          } else if (Array.isArray(last)) {
            children = [];
            for (_j = 0, _len1 = last.length; _j < _len1; _j++) {
              subpath = last[_j];
              if (isPattern) {
                children.push.apply(children, subpath.getChild(token));
              } else {
                if ((child = subpath.getChild(token))) {
                  children.push(child);
                }
              }
            }
            last = children;
          } else {
            last = last.getChild(token);
          }
        }
      }
      return last;
    };

    Tree.prototype.getNode = function(addressOrId) {
      if (typeof addressOrId === 'number') {
        return this.getNodeById(addressOrId);
      } else if (address.isValidPattern(addressOrId)) {
        return this.getNodesByPattern(addressOrId);
      } else {
        return this.getNodeByAddress(addressOrId);
      }
    };

    Tree.prototype.createNode = function(addr) {
      var i, node, token, tokens;
      if (!address.isValidAddress(addr)) {
        throw new Error("Invalid address `" + addr + "`");
      }
      if (this.getNodeByAddress(addr)) {
        throw new Error("Node `" + addr + "` already exist");
      }
      tokens = addr.slice(1).split("/");
      node = this.getOrCreateChild(tokens[0]);
      i = 1;
      while (i < tokens.length) {
        token = tokens[i++];
        node = node.getOrCreateChild(token);
      }
      return node;
    };

    Tree.prototype.getOrCreateNode = function(address) {
      var node;
      if ((node = this.getNodeByAddress(address))) {
        return node;
      }
      return this.createNode(address);
    };

    return Tree;

  })(Node);

  Tree.prototype.getNodes = Tree.prototype.getNode;

  module.exports = Tree;

}).call(this);

});

require.define("/src/a2r-hub/address.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var ADDRESS_REPLACE, ADDRESS_REPLACE_REGEXP, ALLOWED_TOKEN_CHARACTER_SET, INVALID_TOKEN_REGEXP, RESERVED_CHARACTERS, RESERVED_TOKEN_CHARACTER_SET, TOKEN_REPLACE, TOKEN_REPLACE_REGEXP, VALID_TOKEN_REGEXP, address;

  RESERVED_CHARACTERS = "\\#\\*,\\?\\[\\]{}\\s";

  ALLOWED_TOKEN_CHARACTER_SET = "[^" + RESERVED_CHARACTERS + "/]";

  RESERVED_TOKEN_CHARACTER_SET = "[" + RESERVED_CHARACTERS + "/]";

  VALID_TOKEN_REGEXP = new RegExp(ALLOWED_TOKEN_CHARACTER_SET);

  INVALID_TOKEN_REGEXP = new RegExp(RESERVED_TOKEN_CHARACTER_SET);

  TOKEN_REPLACE_REGEXP = new RegExp("(\\?|\\*|\\[.*\\]|{.*})", "g");

  TOKEN_REPLACE = function(_, pattern) {
    var negate, tok, tokens;
    switch (pattern.charAt(0)) {
      case '*':
        return ALLOWED_TOKEN_CHARACTER_SET + "{0,}";
      case '?':
        return ALLOWED_TOKEN_CHARACTER_SET + "{1}";
      case '[':
        if (pattern.charAt(1) === '!') {
          negate = true;
          pattern = pattern.slice(2, -1);
        } else {
          pattern = pattern.slice(1, -1);
        }
        if (INVALID_TOKEN_REGEXP.test(pattern)) {
          throw new Error("Invalid pattern '" + path + "'");
        } else {
          if (negate) {
            return "[^" + pattern + "]";
          } else {
            return "[" + pattern + "]";
          }
        }
        break;
      case '{':
        pattern = pattern.slice(1, -1);
        tokens = (function() {
          var _i, _len, _ref, _results;
          _ref = pattern.split(",");
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            tok = _ref[_i];
            if (INVALID_TOKEN_REGEXP.test(tok)) {
              throw new Error("Invalid pattern '" + path + "'");
            } else {
              _results.push(tok);
            }
          }
          return _results;
        })();
        return "(?:" + (tokens.join('|')) + ")";
    }
  };

  ADDRESS_REPLACE_REGEXP = /(\/)?(\/)?([^\/]*)?/g;

  ADDRESS_REPLACE = function(_, slash, ml, capture) {
    var reg;
    reg = ml ? "(?:/.*)*" : (slash ? "/" : "");
    if (capture) {
      if (ml) {
        reg += "/";
      }
      reg += capture.replace(TOKEN_REPLACE_REGEXP, TOKEN_REPLACE);
    }
    return reg;
  };

  module.exports = address = {
    isPattern: function(addr) {
      return /(?:\/\/|\?|\*|\[.*\]|{.*})/.test(addr);
    },
    isValidToken: function(token) {
      return VALID_TOKEN_REGEXP.test(token);
    },
    isValidAddress: function(addr) {
      return addr.charAt(0) === "/" && !address.isPattern(addr);
    },
    isValidPattern: function(addr) {
      return addr.charAt(0) === "/" && address.isPattern(addr);
    },
    compilePattern: function(path, sensitive) {
      if (sensitive == null) {
        sensitive = true;
      }
      path = path.replace(ADDRESS_REPLACE_REGEXP, ADDRESS_REPLACE);
      return new RegExp("^" + path + "$", sensitive ? "" : "i");
    },
    compileTokenPattern: function(token, sensitive) {
      var pattern;
      if (sensitive == null) {
        sensitive = true;
      }
      pattern = token.replace(TOKEN_REPLACE_REGEXP, TOKEN_REPLACE);
      return new RegExp("^" + pattern + "$", sensitive ? "" : "i");
    }
  };

}).call(this);

});

require.define("/node_modules/a2r-osc/lib/a2r-osc/osc.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.4.0
(function() {
  var AbstractOscPacketGenerator, AbstractOscPacketParser, Bundle, Impulse, Message, NUMBERS, OSC_TYPES, OSC_TYPES_BY_NAME, OscArrayBufferPacketGenerator, OscArrayBufferPacketParser, OscBufferPacketGenerator, OscBufferPacketParser, SECONDS_FROM_1900_to_1970, code, desc, exports, fromBuffer, fromNTP, name, nodeBuffer, oscPadding, oscSizeOf, oscSizeOfBlob, oscSizeOfBundle, oscSizeOfMessage, oscSizeOfString, oscTypeCodeOf, toInteger, toNTP, toNumber, type, _fn, _fn1, _fn2, _fn3, _fn4, _fn5,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  nodeBuffer = typeof Buffer === 'function';

  toNumber = function(val) {
    val = Number(val);
    if (val === NaN) {
      throw new Error("Value isn't a number");
    }
    return val;
  };

  toInteger = function(val) {
    val = toNumber(val);
    return Math.round(val);
  };

  SECONDS_FROM_1900_to_1970 = 2208988800;

  fromNTP = function(seconds, fraction) {
    var date, ms;
    if (seconds === 0 && fraction === 1) {
      return new Date;
    }
    ms = (seconds - SECONDS_FROM_1900_to_1970) * 1000;
    ms += Math.round(1000 * fraction / 0x100000000);
    date = new Date(ms);
    date.ntpSeconds = seconds;
    date.ntpFraction = fraction;
    return date;
  };

  toNTP = function(date) {
    var fraction, seconds, time;
    if (date === 1) {
      return [0, 1];
    }
    if (Array.isArray(date)) {
      return date;
    }
    time = date.getTime();
    seconds = Math.floor(time / 1000);
    fraction = Math.round(((time % 1000) * 0x100000000) / 1000);
    return [seconds + SECONDS_FROM_1900_to_1970, fraction];
  };

  OSC_TYPES = {
    i: {
      name: "integer",
      read: function(reader) {
        return reader.readInt32();
      },
      write: function(writer, value) {
        return writer.writeInt32(value);
      },
      cast: toInteger,
      sizeOf: function(value) {
        return 4;
      }
    },
    f: {
      name: "float",
      read: function(reader) {
        return reader.readFloat();
      },
      write: function(writer, value) {
        return writer.writeFloat(value);
      },
      cast: toNumber,
      sizeOf: function(value) {
        return 4;
      }
    },
    s: {
      name: "string",
      read: function(reader) {
        return reader.readString();
      },
      write: function(writer, value) {
        return writer.writeString(value);
      },
      cast: function(value) {
        return value.toString();
      },
      sizeOf: function(value) {
        return oscSizeOfString(value.toString());
      }
    },
    b: {
      name: "blob",
      read: function(reader) {
        return reader.readBlob();
      },
      write: function(writer, value) {
        return writer.writeBlob(value);
      },
      sizeOf: function(value) {
        return oscSizeOfBlob(value);
      }
    },
    d: {
      name: "double",
      read: function(reader) {
        return reader.readDouble();
      },
      write: function(writer, value) {
        return writer.writeDouble(value);
      },
      sizeOf: function(value) {
        return 8;
      }
    },
    c: {
      name: "char",
      read: function(reader) {
        return String.fromCharCode(reader.readInt32() & 0x7F);
      },
      write: function(writer, value) {
        return writer.writeInt32(value.charCodeAt(0));
      },
      cast: function(value) {
        return value.toString().charAt(0);
      },
      sizeOf: function(value) {
        return 4;
      }
    },
    r: {
      name: "color",
      read: function(reader) {
        return reader.readInt32();
      },
      write: function(writer, value) {
        return writer.writeInt32(value);
      },
      cast: toInteger,
      sizeOf: function(value) {
        return 4;
      }
    },
    t: {
      name: "time",
      read: function(reader) {
        return reader.readTimetag();
      },
      write: function(writer, value) {
        return writer.writeTimetag(value);
      },
      cast: toNTP,
      sizeOf: function() {
        return 8;
      }
    },
    T: {
      name: "true",
      read: function() {
        return true;
      }
    },
    F: {
      name: "false",
      read: function() {
        return false;
      }
    },
    N: {
      name: "null",
      read: function() {
        return null;
      }
    },
    I: {
      name: "impulse",
      read: function() {
        return Impulse;
      }
    }
  };

  OSC_TYPES.S = OSC_TYPES.s;

  OSC_TYPES_BY_NAME = {};

  for (code in OSC_TYPES) {
    type = OSC_TYPES[code];
    if (code !== 'S') {
      type.code = code;
    }
    OSC_TYPES_BY_NAME[type.name] = type;
  }

  NUMBERS = {
    Int32: {
      dataViewReader: "getInt32",
      dataViewWriter: "setInt32",
      bufferReader: "readInt32BE",
      bufferWriter: "writeInt32BE",
      size: 4
    },
    UInt32: {
      dataViewReader: "getUint32",
      dataViewWriter: "setUint32",
      bufferReader: "readUInt32BE",
      bufferWriter: "writeUInt32BE",
      size: 4
    },
    Float: {
      dataViewReader: "getFloat32",
      dataViewWriter: "setFloat32",
      bufferReader: "readFloatBE",
      bufferWriter: "writeFloatBE",
      size: 4
    },
    Double: {
      dataViewReader: "getFloat64",
      dataViewWriter: "setFloat64",
      bufferReader: "readDoubleBE",
      bufferWriter: "writeDoubleBE",
      size: 8
    }
  };

  oscPadding = function(len) {
    return 4 - len % 4;
  };

  Impulse = new Object;

  oscTypeCodeOf = function(val) {
    switch (typeof val) {
      case 'string':
        return 's';
      case 'number':
        return 'f';
      case 'boolean':
        if (val) {
          return 'T';
        } else {
          return 'F';
        }
        break;
      case 'undefined':
        throw new Error("Value can't be undefined");
        break;
      case 'object':
        if (val === null) {
          return 'N';
        } else if (val instanceof Date) {
          return 't';
        } else if ((nodeBuffer && Buffer.isBuffer(val)) || val instanceof ArrayBuffer) {
          return 'b';
        } else if (val === Impulse) {
          return 'I';
        } else {
          throw new Error("Unsupported type `" + val + "`");
        }
        break;
      default:
        throw new Error("Unsupported type `" + val + "`");
    }
  };

  oscSizeOfString = function(str) {
    return str.length + oscPadding(str.length);
  };

  oscSizeOfBlob = function(buf) {
    var length, pad;
    if (buf instanceof ArrayBuffer) {
      length = 4 + buf.byteLength;
    } else {
      length = 4 + buf.length;
    }
    pad = oscPadding(length);
    if (pad < 4) {
      length += pad;
    }
    return length;
  };

  oscSizeOfBundle = function(bundle, dict) {
    var elem, size, _i, _len, _ref;
    size = 16;
    _ref = bundle.elements;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      elem = _ref[_i];
      size += 4 + oscSizeOfMessage(elem, dict);
    }
    return size;
  };

  oscSizeOfMessage = function(msg, dict) {
    var addressId, i, l, size, tl, typeCode, value;
    addressId = dict != null ? dict[msg.address] : void 0;
    if (addressId) {
      size = 8;
    } else {
      size = oscSizeOfString(msg.address);
    }
    if (addressId) {
      tl = msg.typeTag.length + 2;
    } else {
      tl = msg.typeTag.length + 1;
    }
    size += tl + oscPadding(tl);
    i = 0;
    l = msg.typeTag.length;
    while (i < l) {
      typeCode = msg.typeTag.charAt(i);
      value = msg["arguments"][i++];
      size += oscSizeOf(value, typeCode);
    }
    return size;
  };

  oscSizeOf = function(value, code) {
    if (code) {
      type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
      if (!type) {
        throw new Error("Type `" + code + "` isn't supported");
      }
      if (!type.sizeOf) {
        return 0;
      }
      return type.sizeOf(value);
    } else {
      code = oscTypeCodeOf(value);
      return oscSizeOf(value, code);
    }
  };

  Message = (function() {

    function Message(address, typeTag, args) {
      var value;
      this.address = address;
      if (typeTag && !(args != null)) {
        args = typeTag;
        typeTag = null;
      }
      if (!Array.isArray(args)) {
        args = [args];
      }
      if (typeTag) {
        this.typeTag = typeTag;
        this["arguments"] = args;
      } else {
        this.typeTag = "";
        this["arguments"] = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = args.length; _i < _len; _i++) {
            value = args[_i];
            if (typeof value === 'object' && ((value != null ? value.type : void 0) != null)) {
              code = value.type;
              type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
              if (!type) {
                throw new Error("Type `" + code + "` isn't supported");
              }
              this.typeTag += type.code;
              if (type.sizeOf) {
                _results.push(value.value);
              } else {
                _results.push(type.read());
              }
            } else {
              this.typeTag += oscTypeCodeOf(value);
              _results.push(value);
            }
          }
          return _results;
        }).call(this);
      }
      if (this["arguments"].length !== this.typeTag.length) {
        throw new Error("Arguments doesn't match typetag");
      }
    }

    Message.prototype.toBuffer = function(dict) {
      if (nodeBuffer) {
        return new OscBufferPacketGenerator(this, dict).generate();
      } else {
        return new OscArrayBufferPacketGenerator(this, dict).generate();
      }
    };

    Message.prototype.equal = function(other) {
      var arg, i, _i, _len, _ref;
      if (!(other instanceof Message)) {
        return false;
      }
      if (other.address !== this.address) {
        return false;
      }
      if (other.typeTag !== this.typeTag) {
        return false;
      }
      if (other["arguments"].length !== this["arguments"].length) {
        return false;
      }
      _ref = this["arguments"];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        arg = _ref[i];
        if (other["arguments"][i] !== arg) {
          return false;
        }
      }
      return true;
    };

    return Message;

  })();

  Bundle = (function() {

    function Bundle(timetag, elements) {
      var elem, _i, _len, _ref;
      if (timetag instanceof Date) {
        this.timetag = timetag;
      } else if (timetag === 1) {
        this.timetag = new Date;
      } else {
        this.timetag = new Date;
        elements = timetag;
      }
      if (elements) {
        if (!Array.isArray(elements)) {
          elements = [elements];
        }
        this.elements = elements;
      } else {
        this.elements = [];
      }
      _ref = this.elements;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        if (!elem instanceof Message) {
          throw new Error("A bundle element must be an instance of Message");
        }
      }
      null;
    }

    Bundle.prototype.addElement = function(address, typeTag, args) {
      var msg;
      if (address instanceof Message) {
        this.elements.push(address);
        return address;
      } else {
        msg = new Message(address, typeTag, args);
        this.elements.push(msg);
        return msg;
      }
    };

    Bundle.prototype.message = function(address, typeTag, args) {
      this.addElement(address, typeTag, args);
      return this;
    };

    Bundle.prototype.toBuffer = function(dict) {
      if (nodeBuffer) {
        return new OscBufferPacketGenerator(this, dict).generate();
      } else {
        return new OscArrayBufferPacketGenerator(this, dict).generate();
      }
    };

    Bundle.prototype.equal = function(other) {
      var elem, i, _i, _len, _ref;
      if (!(other instanceof Bundle)) {
        return false;
      }
      if (other.timetag !== this.timetag) {
        return false;
      }
      if (other.elements.length !== this.elements.length) {
        return false;
      }
      _ref = this.elements;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        elem = _ref[i];
        if (!elem.equal(other.elements[i])) {
          return false;
        }
      }
      return true;
    };

    return Bundle;

  })();

  AbstractOscPacketGenerator = (function() {

    function AbstractOscPacketGenerator(messageOrBundle, dict) {
      this.dict = dict;
      if (messageOrBundle instanceof Bundle) {
        this.bundle = messageOrBundle;
        this.size = oscSizeOfBundle(this.bundle, this.dict);
      } else {
        this.message = messageOrBundle;
        this.size = oscSizeOfMessage(this.message, this.dict);
      }
    }

    AbstractOscPacketGenerator.prototype.generateMessage = function(msg) {
      var addressId, i, l, value, _results;
      if (this.dict && (addressId = this.dict[msg.address])) {
        this.writeUInt32(0x2f000000);
        this.writeString(",i" + msg.typeTag);
        this.writeInt32(toInteger(addressId));
      } else {
        this.writeString(msg.address);
        this.writeString("," + msg.typeTag);
      }
      i = 0;
      l = msg.typeTag.length;
      _results = [];
      while (i < l) {
        code = msg.typeTag.charAt(i);
        value = msg["arguments"][i++];
        type = OSC_TYPES[code];
        if (!type) {
          throw new Error("Type `" + code + "` isn't supported");
        }
        if (type.write) {
          if (type.cast) {
            value = type.cast(value);
          }
          _results.push(type.write(this, value));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    AbstractOscPacketGenerator.prototype.generateBundle = function(bundle) {
      var elem, tag, _i, _len, _ref;
      this.writeString("#bundle");
      if (bundle.timetag <= new Date) {
        tag = [0, 1];
      } else {
        tag = toNTP(bundle.timetag);
      }
      this.writeTimetag(tag);
      _ref = bundle.elements;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        this.writeInt32(oscSizeOfMessage(elem, this.dict));
        this.generateMessage(elem);
      }
      return null;
    };

    AbstractOscPacketGenerator.prototype.writeTimetag = function(tag) {
      this.writeUInt32(tag[0]);
      return this.writeUInt32(tag[1]);
    };

    AbstractOscPacketGenerator.prototype.generate = function() {
      if (this.bundle) {
        this.generateBundle(this.bundle);
      } else {
        this.generateMessage(this.message);
      }
      return this.buffer;
    };

    AbstractOscPacketGenerator.prototype.writeString = function(string, encoding) {
      if (encoding == null) {
        encoding = "ascii";
      }
      throw new Error("Abstract method `AbstractOscPacketGenerator::writeString` called");
    };

    return AbstractOscPacketGenerator;

  })();

  _fn = function(name) {
    name = "write" + name;
    return AbstractOscPacketGenerator.prototype[name] = function() {
      throw new Error("Abstract method `AbstractOscPacketGenerator::" + name + "` called");
    };
  };
  for (name in NUMBERS) {
    desc = NUMBERS[name];
    _fn(name);
  }

  OscArrayBufferPacketGenerator = (function(_super) {

    __extends(OscArrayBufferPacketGenerator, _super);

    function OscArrayBufferPacketGenerator(messageOrBundle, dict) {
      OscArrayBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
      this.buffer = new ArrayBuffer(this.size);
      this.view = new DataView(this.buffer);
      this.pos = 0;
    }

    OscArrayBufferPacketGenerator.prototype.writeString = function(string, encoding) {
      var char, i, l, pad, _results;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (encoding !== "ascii") {
        throw new Error("OscBufferWriter::writeString only supports ASCII encoding for ArrayBuffer");
      }
      l = string.length;
      i = 0;
      while (i < l) {
        char = string.charCodeAt(i++);
        this.view.setInt8(this.pos++, char & 0x7F);
      }
      pad = oscPadding(l);
      i = 0;
      _results = [];
      while (i < pad) {
        this.view.setInt8(this.pos++, 0);
        _results.push(i++);
      }
      return _results;
    };

    OscArrayBufferPacketGenerator.prototype.writeBlob = function(buffer) {
      var array, i, l, pad;
      if (nodeBuffer && Buffer.isBuffer(buffer)) {
        l = buffer.length;
        this.writeInt32(l);
        i = 0;
        while (i < l) {
          this.view.setInt8(this.pos + i, buffer[i]);
          i++;
        }
        this.pos += l;
      } else {
        l = buffer.byteLength;
        array = new Int8Array(buffer);
        this.writeInt32(l);
        i = 0;
        while (i < l) {
          this.view.setInt8(this.pos + i, array[i]);
          i++;
        }
        this.pos += l;
      }
      pad = oscPadding(4 + l);
      if (pad && pad < 4) {
        i = 0;
        while (i < pad) {
          this.view.setInt8(this.pos + i, 0);
          i++;
        }
        return this.pos += pad;
      }
    };

    return OscArrayBufferPacketGenerator;

  })(AbstractOscPacketGenerator);

  _fn1 = function(type, desc) {
    return OscArrayBufferPacketGenerator.prototype["write" + type] = function(value) {
      value = this.view[desc.dataViewWriter](this.pos, value, false);
      this.pos += desc.size;
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn1(type, desc);
  }

  OscBufferPacketGenerator = (function(_super) {

    __extends(OscBufferPacketGenerator, _super);

    function OscBufferPacketGenerator(messageOrBundle, dict) {
      OscBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
      this.buffer = new Buffer(this.size);
      this.pos = 0;
    }

    OscBufferPacketGenerator.prototype.writeString = function(string, encoding) {
      var length, pad;
      if (encoding == null) {
        encoding = "ascii";
      }
      length = Buffer.byteLength(string, encoding);
      this.buffer.write(string, this.pos, length, encoding);
      this.pos += length;
      pad = oscPadding(length);
      this.buffer.fill(0, this.pos, this.pos + pad);
      return this.pos += pad;
    };

    OscBufferPacketGenerator.prototype.writeBlob = function(buffer) {
      var array, i, length, pad;
      if (buffer instanceof ArrayBuffer) {
        length = buffer.byteLength;
        this.writeInt32(length);
        array = new Int8Array(buffer);
        i = 0;
        while (i < length) {
          this.buffer[this.pos + i] = array[i];
          i++;
        }
      } else {
        length = buffer.length;
        this.writeInt32(length);
        buffer.copy(this.buffer, this.pos);
      }
      pad = oscPadding(4 + length);
      this.pos += length;
      if (pad && pad < 4) {
        this.buffer.fill(0, this.pos, this.pos + pad);
        return this.pos += pad;
      }
    };

    return OscBufferPacketGenerator;

  })(AbstractOscPacketGenerator);

  _fn2 = function(type, desc) {
    return OscBufferPacketGenerator.prototype["write" + type] = function(value) {
      value = this.buffer[desc.bufferWriter](value, this.pos);
      this.pos += desc.size;
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn2(type, desc);
  }

  AbstractOscPacketParser = (function() {

    function AbstractOscPacketParser(buffer, pos, dict) {
      if (pos == null) {
        pos = 0;
      }
      this.buffer = buffer;
      if (typeof pos === "object") {
        this.dict = pos;
        this.pos = 0;
      } else {
        this.dict = dict;
        this.pos = pos;
      }
    }

    AbstractOscPacketParser.prototype.parse = function() {
      var address;
      address = this.readString();
      if (address === "#bundle") {
        return this._parseBundle();
      } else {
        return this._parseMessage(address);
      }
    };

    AbstractOscPacketParser.prototype._parseMessage = function(address) {
      var addressId, args, typeTag;
      if (address.charAt(0) !== '/') {
        throw new Error("A address must start with a '/'");
      }
      if (this.dict && (address === "/" || address === "/?")) {
        typeTag = this.readTypeTag();
        args = this.parseArguments(typeTag);
        if (typeTag.charAt(0) !== 'i') {
          throw new Error("Messages with compressed addresses must have an integer as first arguments type");
        }
        typeTag = typeTag.slice(1, 1);
        addressId = args.shift();
        address = this.dict[addressId];
        if (!address) {
          throw new Error("No address with id `" + addressId + "` found");
        }
      } else {
        typeTag = this.readTypeTag();
        args = this.parseArguments(typeTag);
      }
      return new Message(address, typeTag, args);
    };

    AbstractOscPacketParser.prototype._parseBundle = function() {
      var boundary, elements, size, timetag;
      timetag = this.readTimetag();
      elements = [];
      while (!this.isEnd()) {
        size = this.readInt32();
        boundary = this.pos + size;
        elements.push(this.parse());
      }
      return new Bundle(timetag, elements);
    };

    AbstractOscPacketParser.prototype.parseArguments = function(tag, boundary) {
      var i, values;
      i = 0;
      values = [];
      while (i < tag.length) {
        if (boundary && this.pos >= boundary) {
          throw new Error("Message boundary reached");
        }
        code = tag.charAt(i++);
        type = OSC_TYPES[code];
        if (!type) {
          throw new Error("Type `" + code + "` isn't supported");
        }
        values.push(type.read(this));
      }
      return values;
    };

    AbstractOscPacketParser.prototype.readTypeTag = function() {
      var tag;
      tag = this.readString();
      if (tag.charAt(0) === ',') {
        tag = tag.slice(1);
      } else {
        throw new Error("A type tag must start with a ','");
      }
      return tag;
    };

    AbstractOscPacketParser.prototype.readTimetag = function() {
      return fromNTP(this.readUInt32(), this.readUInt32());
    };

    AbstractOscPacketParser.prototype.readString = function(encoding, move) {
      throw new Error("Abstract method `AbstractOscPacketParser::writeString` called");
    };

    AbstractOscPacketParser.prototype.isEnd = function() {
      throw new Error("Abstract method `AbstractOscPacketParser::isEnd` called");
    };

    return AbstractOscPacketParser;

  })();

  _fn3 = function(name) {
    name = "read" + name;
    return AbstractOscPacketParser.prototype[name] = function() {
      throw new Error("Abstract method `AbstractOscPacketParser::" + name + "` called");
    };
  };
  for (name in NUMBERS) {
    desc = NUMBERS[name];
    _fn3(name);
  }

  OscArrayBufferPacketParser = (function(_super) {

    __extends(OscArrayBufferPacketParser, _super);

    function OscArrayBufferPacketParser(buffer, pos, dict) {
      OscArrayBufferPacketParser.__super__.constructor.apply(this, arguments);
      this.view = new DataView(this.buffer);
    }

    OscArrayBufferPacketParser.prototype.isEnd = function() {
      return this.buffer.byteLength === 0 || this.pos === this.buffer.byteLength;
    };

    OscArrayBufferPacketParser.prototype.toString = function(encoding, start, end) {
      var charCode, str;
      start = start != null ? start : 0;
      end = end != null ? end : this.buffer.byteLength;
      str = "";
      while (start < end) {
        charCode = this.view.getInt8(start++);
        str += String.fromCharCode(charCode & 0x7F);
      }
      return str;
    };

    OscArrayBufferPacketParser.prototype.readBlob = function(move) {
      var array, i, pad, size;
      if (move == null) {
        move = true;
      }
      size = this.readInt32();
      i = 0;
      array = new Int8Array(new ArrayBuffer(size));
      while (i < size) {
        array[i] = this.view.getInt8(this.pos + i);
        i++;
      }
      if (move) {
        pad = oscPadding(4 + size);
        if (pad < 4) {
          size += pad;
        }
        this.pos += size;
      }
      return array.buffer;
    };

    OscArrayBufferPacketParser.prototype.readString = function(encoding, move) {
      var length, nullSeen, pos, string, stringLength;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (move == null) {
        move = true;
      }
      if (this.isEnd()) {
        throw new Error("No data left");
      }
      length = 4;
      nullSeen = false;
      while ((pos = this.pos + length - 1) < this.buffer.byteLength) {
        if (this.view.getInt8(pos) === 0) {
          nullSeen = true;
          break;
        }
        length += 4;
      }
      if (length === 0 || nullSeen === false) {
        throw new Error("No string data found");
      }
      stringLength = length - 4;
      while (stringLength < length) {
        if (this.view.getInt8(this.pos + stringLength) === 0) {
          break;
        }
        stringLength++;
      }
      string = this.toString(encoding, this.pos, this.pos + stringLength);
      if (move) {
        this.pos += length;
      }
      return string;
    };

    return OscArrayBufferPacketParser;

  })(AbstractOscPacketParser);

  _fn4 = function(type, desc) {
    return OscArrayBufferPacketParser.prototype["read" + type] = function(move) {
      var value;
      if (move == null) {
        move = true;
      }
      value = this.view[desc.dataViewReader](this.pos, false);
      if (move) {
        this.pos += desc.size;
      }
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn4(type, desc);
  }

  OscBufferPacketParser = (function(_super) {

    __extends(OscBufferPacketParser, _super);

    function OscBufferPacketParser(buffer, pos, dict) {
      OscBufferPacketParser.__super__.constructor.apply(this, arguments);
    }

    OscBufferPacketParser.prototype.isEnd = function() {
      return this.buffer.length === 0 || this.pos === this.buffer.length;
    };

    OscBufferPacketParser.prototype.toString = function() {
      return this.buffer.toString.apply(this.buffer, arguments);
    };

    OscBufferPacketParser.prototype.readBlob = function(move) {
      var buf, pad, size;
      if (move == null) {
        move = true;
      }
      size = this.readInt32();
      buf = new Buffer(size);
      this.buffer.copy(buf, 0, this.pos, this.pos + size);
      if (move) {
        pad = oscPadding(4 + size);
        if (pad < 4) {
          size += pad;
        }
        this.pos += size;
      }
      return buf;
    };

    OscBufferPacketParser.prototype.readString = function(encoding, move) {
      var length, nullSeen, pos, string, stringLength;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (move == null) {
        move = true;
      }
      if (this.isEnd()) {
        throw new Error("No data left");
      }
      length = 4;
      nullSeen = false;
      while ((pos = this.pos + length - 1) < this.buffer.length) {
        if (this.buffer[pos] === 0) {
          nullSeen = true;
          break;
        }
        length += 4;
      }
      if (length === 0 || nullSeen === false) {
        throw new Error("No string data found");
      }
      stringLength = length - 4;
      while (stringLength < length) {
        if (this.buffer[this.pos + stringLength] === 0) {
          break;
        }
        stringLength++;
      }
      string = this.toString(encoding, this.pos, this.pos + stringLength);
      if (move) {
        this.pos += length;
      }
      return string;
    };

    return OscBufferPacketParser;

  })(AbstractOscPacketParser);

  _fn5 = function(type, desc) {
    return OscBufferPacketParser.prototype["read" + type] = function(move) {
      var value;
      if (move == null) {
        move = true;
      }
      value = this.buffer[desc.bufferReader](this.pos);
      if (move) {
        this.pos += desc.size;
      }
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn5(type, desc);
  }

  fromBuffer = function(buffer, pos, dict) {
    if (nodeBuffer && Buffer.isBuffer(buffer)) {
      return new OscBufferPacketParser(buffer, pos, dict).parse();
    } else {
      return new OscArrayBufferPacketParser(buffer, pos, dict).parse();
    }
  };

  exports = module.exports;

  exports.NUMBERS = NUMBERS;

  exports.toNTP = toNTP;

  exports.Message = Message;

  exports.Bundle = Bundle;

  exports.Impulse = Impulse;

  exports.AbstractOscPacketGenerator = AbstractOscPacketGenerator;

  exports.AbstractOscPacketParser = AbstractOscPacketParser;

  exports.OscBufferPacketGenerator = OscBufferPacketGenerator;

  exports.OscBufferPacketParser = OscBufferPacketParser;

  exports.OscArrayBufferPacketGenerator = OscArrayBufferPacketGenerator;

  exports.OscArrayBufferPacketParser = OscArrayBufferPacketParser;

  exports.fromBuffer = fromBuffer;

}).call(this);

});

require.define("/node_modules/a2r-osc/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/node_modules/a2r-osc/index.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = process.env.OSC_COV ?
  require("./lib-cov/a2r-osc") :
  (require.extensions[".coffee"] ? require("./src/a2r-osc") : require("./lib/a2r-osc"))

});

require.define("/node_modules/a2r-osc/lib-cov/a2r-osc/index.js",function(require,module,exports,__dirname,__filename,process,global){/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['a2r-osc/index.js']) {
  _$jscoverage['a2r-osc/index.js'] = [];
  _$jscoverage['a2r-osc/index.js'][2] = 0;
  _$jscoverage['a2r-osc/index.js'][3] = 0;
  _$jscoverage['a2r-osc/index.js'][5] = 0;
  _$jscoverage['a2r-osc/index.js'][7] = 0;
  _$jscoverage['a2r-osc/index.js'][9] = 0;
  _$jscoverage['a2r-osc/index.js'][11] = 0;
}
_$jscoverage['a2r-osc/index.js'][2]++;
(function () {
  _$jscoverage['a2r-osc/index.js'][3]++;
  var stream;
  _$jscoverage['a2r-osc/index.js'][5]++;
  module.exports = require("./osc");
  _$jscoverage['a2r-osc/index.js'][7]++;
  stream = require("./stream");
  _$jscoverage['a2r-osc/index.js'][9]++;
  module.exports.UnpackStream = stream.UnpackStream;
  _$jscoverage['a2r-osc/index.js'][11]++;
  module.exports.PackStream = stream.PackStream;
}).call(this);
_$jscoverage['a2r-osc/index.js'].source = ["// Generated by CoffeeScript 1.4.0","(function() {","  var stream;","","  module.exports = require(\"./osc\");","","  stream = require(\"./stream\");","","  module.exports.UnpackStream = stream.UnpackStream;","","  module.exports.PackStream = stream.PackStream;","","}).call(this);"];

});

require.define("/node_modules/a2r-osc/lib-cov/a2r-osc/osc.js",function(require,module,exports,__dirname,__filename,process,global){/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['a2r-osc/osc.js']) {
  _$jscoverage['a2r-osc/osc.js'] = [];
  _$jscoverage['a2r-osc/osc.js'][2] = 0;
  _$jscoverage['a2r-osc/osc.js'][3] = 0;
  _$jscoverage['a2r-osc/osc.js'][5] = 0;
  _$jscoverage['a2r-osc/osc.js'][7] = 0;
  _$jscoverage['a2r-osc/osc.js'][9] = 0;
  _$jscoverage['a2r-osc/osc.js'][10] = 0;
  _$jscoverage['a2r-osc/osc.js'][11] = 0;
  _$jscoverage['a2r-osc/osc.js'][12] = 0;
  _$jscoverage['a2r-osc/osc.js'][14] = 0;
  _$jscoverage['a2r-osc/osc.js'][17] = 0;
  _$jscoverage['a2r-osc/osc.js'][18] = 0;
  _$jscoverage['a2r-osc/osc.js'][19] = 0;
  _$jscoverage['a2r-osc/osc.js'][22] = 0;
  _$jscoverage['a2r-osc/osc.js'][24] = 0;
  _$jscoverage['a2r-osc/osc.js'][25] = 0;
  _$jscoverage['a2r-osc/osc.js'][26] = 0;
  _$jscoverage['a2r-osc/osc.js'][27] = 0;
  _$jscoverage['a2r-osc/osc.js'][29] = 0;
  _$jscoverage['a2r-osc/osc.js'][30] = 0;
  _$jscoverage['a2r-osc/osc.js'][31] = 0;
  _$jscoverage['a2r-osc/osc.js'][32] = 0;
  _$jscoverage['a2r-osc/osc.js'][33] = 0;
  _$jscoverage['a2r-osc/osc.js'][34] = 0;
  _$jscoverage['a2r-osc/osc.js'][37] = 0;
  _$jscoverage['a2r-osc/osc.js'][38] = 0;
  _$jscoverage['a2r-osc/osc.js'][39] = 0;
  _$jscoverage['a2r-osc/osc.js'][40] = 0;
  _$jscoverage['a2r-osc/osc.js'][42] = 0;
  _$jscoverage['a2r-osc/osc.js'][43] = 0;
  _$jscoverage['a2r-osc/osc.js'][45] = 0;
  _$jscoverage['a2r-osc/osc.js'][46] = 0;
  _$jscoverage['a2r-osc/osc.js'][47] = 0;
  _$jscoverage['a2r-osc/osc.js'][48] = 0;
  _$jscoverage['a2r-osc/osc.js'][51] = 0;
  _$jscoverage['a2r-osc/osc.js'][55] = 0;
  _$jscoverage['a2r-osc/osc.js'][58] = 0;
  _$jscoverage['a2r-osc/osc.js'][62] = 0;
  _$jscoverage['a2r-osc/osc.js'][68] = 0;
  _$jscoverage['a2r-osc/osc.js'][71] = 0;
  _$jscoverage['a2r-osc/osc.js'][75] = 0;
  _$jscoverage['a2r-osc/osc.js'][81] = 0;
  _$jscoverage['a2r-osc/osc.js'][84] = 0;
  _$jscoverage['a2r-osc/osc.js'][87] = 0;
  _$jscoverage['a2r-osc/osc.js'][90] = 0;
  _$jscoverage['a2r-osc/osc.js'][96] = 0;
  _$jscoverage['a2r-osc/osc.js'][99] = 0;
  _$jscoverage['a2r-osc/osc.js'][102] = 0;
  _$jscoverage['a2r-osc/osc.js'][108] = 0;
  _$jscoverage['a2r-osc/osc.js'][111] = 0;
  _$jscoverage['a2r-osc/osc.js'][114] = 0;
  _$jscoverage['a2r-osc/osc.js'][120] = 0;
  _$jscoverage['a2r-osc/osc.js'][123] = 0;
  _$jscoverage['a2r-osc/osc.js'][126] = 0;
  _$jscoverage['a2r-osc/osc.js'][129] = 0;
  _$jscoverage['a2r-osc/osc.js'][135] = 0;
  _$jscoverage['a2r-osc/osc.js'][138] = 0;
  _$jscoverage['a2r-osc/osc.js'][142] = 0;
  _$jscoverage['a2r-osc/osc.js'][148] = 0;
  _$jscoverage['a2r-osc/osc.js'][151] = 0;
  _$jscoverage['a2r-osc/osc.js'][155] = 0;
  _$jscoverage['a2r-osc/osc.js'][161] = 0;
  _$jscoverage['a2r-osc/osc.js'][167] = 0;
  _$jscoverage['a2r-osc/osc.js'][173] = 0;
  _$jscoverage['a2r-osc/osc.js'][179] = 0;
  _$jscoverage['a2r-osc/osc.js'][184] = 0;
  _$jscoverage['a2r-osc/osc.js'][186] = 0;
  _$jscoverage['a2r-osc/osc.js'][188] = 0;
  _$jscoverage['a2r-osc/osc.js'][189] = 0;
  _$jscoverage['a2r-osc/osc.js'][190] = 0;
  _$jscoverage['a2r-osc/osc.js'][191] = 0;
  _$jscoverage['a2r-osc/osc.js'][193] = 0;
  _$jscoverage['a2r-osc/osc.js'][196] = 0;
  _$jscoverage['a2r-osc/osc.js'][227] = 0;
  _$jscoverage['a2r-osc/osc.js'][228] = 0;
  _$jscoverage['a2r-osc/osc.js'][231] = 0;
  _$jscoverage['a2r-osc/osc.js'][233] = 0;
  _$jscoverage['a2r-osc/osc.js'][234] = 0;
  _$jscoverage['a2r-osc/osc.js'][236] = 0;
  _$jscoverage['a2r-osc/osc.js'][238] = 0;
  _$jscoverage['a2r-osc/osc.js'][240] = 0;
  _$jscoverage['a2r-osc/osc.js'][241] = 0;
  _$jscoverage['a2r-osc/osc.js'][243] = 0;
  _$jscoverage['a2r-osc/osc.js'][245] = 0;
  _$jscoverage['a2r-osc/osc.js'][247] = 0;
  _$jscoverage['a2r-osc/osc.js'][248] = 0;
  _$jscoverage['a2r-osc/osc.js'][250] = 0;
  _$jscoverage['a2r-osc/osc.js'][251] = 0;
  _$jscoverage['a2r-osc/osc.js'][252] = 0;
  _$jscoverage['a2r-osc/osc.js'][253] = 0;
  _$jscoverage['a2r-osc/osc.js'][254] = 0;
  _$jscoverage['a2r-osc/osc.js'][255] = 0;
  _$jscoverage['a2r-osc/osc.js'][256] = 0;
  _$jscoverage['a2r-osc/osc.js'][257] = 0;
  _$jscoverage['a2r-osc/osc.js'][259] = 0;
  _$jscoverage['a2r-osc/osc.js'][261] = 0;
  _$jscoverage['a2r-osc/osc.js'][263] = 0;
  _$jscoverage['a2r-osc/osc.js'][267] = 0;
  _$jscoverage['a2r-osc/osc.js'][268] = 0;
  _$jscoverage['a2r-osc/osc.js'][271] = 0;
  _$jscoverage['a2r-osc/osc.js'][272] = 0;
  _$jscoverage['a2r-osc/osc.js'][273] = 0;
  _$jscoverage['a2r-osc/osc.js'][274] = 0;
  _$jscoverage['a2r-osc/osc.js'][276] = 0;
  _$jscoverage['a2r-osc/osc.js'][278] = 0;
  _$jscoverage['a2r-osc/osc.js'][279] = 0;
  _$jscoverage['a2r-osc/osc.js'][280] = 0;
  _$jscoverage['a2r-osc/osc.js'][282] = 0;
  _$jscoverage['a2r-osc/osc.js'][285] = 0;
  _$jscoverage['a2r-osc/osc.js'][286] = 0;
  _$jscoverage['a2r-osc/osc.js'][287] = 0;
  _$jscoverage['a2r-osc/osc.js'][288] = 0;
  _$jscoverage['a2r-osc/osc.js'][289] = 0;
  _$jscoverage['a2r-osc/osc.js'][290] = 0;
  _$jscoverage['a2r-osc/osc.js'][291] = 0;
  _$jscoverage['a2r-osc/osc.js'][293] = 0;
  _$jscoverage['a2r-osc/osc.js'][296] = 0;
  _$jscoverage['a2r-osc/osc.js'][297] = 0;
  _$jscoverage['a2r-osc/osc.js'][298] = 0;
  _$jscoverage['a2r-osc/osc.js'][299] = 0;
  _$jscoverage['a2r-osc/osc.js'][300] = 0;
  _$jscoverage['a2r-osc/osc.js'][302] = 0;
  _$jscoverage['a2r-osc/osc.js'][304] = 0;
  _$jscoverage['a2r-osc/osc.js'][305] = 0;
  _$jscoverage['a2r-osc/osc.js'][307] = 0;
  _$jscoverage['a2r-osc/osc.js'][309] = 0;
  _$jscoverage['a2r-osc/osc.js'][310] = 0;
  _$jscoverage['a2r-osc/osc.js'][311] = 0;
  _$jscoverage['a2r-osc/osc.js'][312] = 0;
  _$jscoverage['a2r-osc/osc.js'][313] = 0;
  _$jscoverage['a2r-osc/osc.js'][314] = 0;
  _$jscoverage['a2r-osc/osc.js'][315] = 0;
  _$jscoverage['a2r-osc/osc.js'][317] = 0;
  _$jscoverage['a2r-osc/osc.js'][320] = 0;
  _$jscoverage['a2r-osc/osc.js'][321] = 0;
  _$jscoverage['a2r-osc/osc.js'][322] = 0;
  _$jscoverage['a2r-osc/osc.js'][323] = 0;
  _$jscoverage['a2r-osc/osc.js'][324] = 0;
  _$jscoverage['a2r-osc/osc.js'][326] = 0;
  _$jscoverage['a2r-osc/osc.js'][327] = 0;
  _$jscoverage['a2r-osc/osc.js'][329] = 0;
  _$jscoverage['a2r-osc/osc.js'][331] = 0;
  _$jscoverage['a2r-osc/osc.js'][332] = 0;
  _$jscoverage['a2r-osc/osc.js'][336] = 0;
  _$jscoverage['a2r-osc/osc.js'][338] = 0;
  _$jscoverage['a2r-osc/osc.js'][339] = 0;
  _$jscoverage['a2r-osc/osc.js'][340] = 0;
  _$jscoverage['a2r-osc/osc.js'][341] = 0;
  _$jscoverage['a2r-osc/osc.js'][342] = 0;
  _$jscoverage['a2r-osc/osc.js'][343] = 0;
  _$jscoverage['a2r-osc/osc.js'][345] = 0;
  _$jscoverage['a2r-osc/osc.js'][346] = 0;
  _$jscoverage['a2r-osc/osc.js'][348] = 0;
  _$jscoverage['a2r-osc/osc.js'][349] = 0;
  _$jscoverage['a2r-osc/osc.js'][350] = 0;
  _$jscoverage['a2r-osc/osc.js'][352] = 0;
  _$jscoverage['a2r-osc/osc.js'][353] = 0;
  _$jscoverage['a2r-osc/osc.js'][354] = 0;
  _$jscoverage['a2r-osc/osc.js'][355] = 0;
  _$jscoverage['a2r-osc/osc.js'][356] = 0;
  _$jscoverage['a2r-osc/osc.js'][357] = 0;
  _$jscoverage['a2r-osc/osc.js'][358] = 0;
  _$jscoverage['a2r-osc/osc.js'][359] = 0;
  _$jscoverage['a2r-osc/osc.js'][360] = 0;
  _$jscoverage['a2r-osc/osc.js'][361] = 0;
  _$jscoverage['a2r-osc/osc.js'][362] = 0;
  _$jscoverage['a2r-osc/osc.js'][364] = 0;
  _$jscoverage['a2r-osc/osc.js'][365] = 0;
  _$jscoverage['a2r-osc/osc.js'][366] = 0;
  _$jscoverage['a2r-osc/osc.js'][368] = 0;
  _$jscoverage['a2r-osc/osc.js'][371] = 0;
  _$jscoverage['a2r-osc/osc.js'][372] = 0;
  _$jscoverage['a2r-osc/osc.js'][375] = 0;
  _$jscoverage['a2r-osc/osc.js'][378] = 0;
  _$jscoverage['a2r-osc/osc.js'][379] = 0;
  _$jscoverage['a2r-osc/osc.js'][383] = 0;
  _$jscoverage['a2r-osc/osc.js'][384] = 0;
  _$jscoverage['a2r-osc/osc.js'][385] = 0;
  _$jscoverage['a2r-osc/osc.js'][387] = 0;
  _$jscoverage['a2r-osc/osc.js'][391] = 0;
  _$jscoverage['a2r-osc/osc.js'][392] = 0;
  _$jscoverage['a2r-osc/osc.js'][393] = 0;
  _$jscoverage['a2r-osc/osc.js'][394] = 0;
  _$jscoverage['a2r-osc/osc.js'][396] = 0;
  _$jscoverage['a2r-osc/osc.js'][397] = 0;
  _$jscoverage['a2r-osc/osc.js'][399] = 0;
  _$jscoverage['a2r-osc/osc.js'][400] = 0;
  _$jscoverage['a2r-osc/osc.js'][402] = 0;
  _$jscoverage['a2r-osc/osc.js'][403] = 0;
  _$jscoverage['a2r-osc/osc.js'][405] = 0;
  _$jscoverage['a2r-osc/osc.js'][406] = 0;
  _$jscoverage['a2r-osc/osc.js'][407] = 0;
  _$jscoverage['a2r-osc/osc.js'][408] = 0;
  _$jscoverage['a2r-osc/osc.js'][409] = 0;
  _$jscoverage['a2r-osc/osc.js'][412] = 0;
  _$jscoverage['a2r-osc/osc.js'][415] = 0;
  _$jscoverage['a2r-osc/osc.js'][419] = 0;
  _$jscoverage['a2r-osc/osc.js'][421] = 0;
  _$jscoverage['a2r-osc/osc.js'][422] = 0;
  _$jscoverage['a2r-osc/osc.js'][423] = 0;
  _$jscoverage['a2r-osc/osc.js'][424] = 0;
  _$jscoverage['a2r-osc/osc.js'][425] = 0;
  _$jscoverage['a2r-osc/osc.js'][426] = 0;
  _$jscoverage['a2r-osc/osc.js'][428] = 0;
  _$jscoverage['a2r-osc/osc.js'][429] = 0;
  _$jscoverage['a2r-osc/osc.js'][431] = 0;
  _$jscoverage['a2r-osc/osc.js'][432] = 0;
  _$jscoverage['a2r-osc/osc.js'][433] = 0;
  _$jscoverage['a2r-osc/osc.js'][435] = 0;
  _$jscoverage['a2r-osc/osc.js'][437] = 0;
  _$jscoverage['a2r-osc/osc.js'][439] = 0;
  _$jscoverage['a2r-osc/osc.js'][440] = 0;
  _$jscoverage['a2r-osc/osc.js'][441] = 0;
  _$jscoverage['a2r-osc/osc.js'][442] = 0;
  _$jscoverage['a2r-osc/osc.js'][443] = 0;
  _$jscoverage['a2r-osc/osc.js'][446] = 0;
  _$jscoverage['a2r-osc/osc.js'][449] = 0;
  _$jscoverage['a2r-osc/osc.js'][450] = 0;
  _$jscoverage['a2r-osc/osc.js'][451] = 0;
  _$jscoverage['a2r-osc/osc.js'][452] = 0;
  _$jscoverage['a2r-osc/osc.js'][453] = 0;
  _$jscoverage['a2r-osc/osc.js'][455] = 0;
  _$jscoverage['a2r-osc/osc.js'][456] = 0;
  _$jscoverage['a2r-osc/osc.js'][457] = 0;
  _$jscoverage['a2r-osc/osc.js'][461] = 0;
  _$jscoverage['a2r-osc/osc.js'][462] = 0;
  _$jscoverage['a2r-osc/osc.js'][463] = 0;
  _$jscoverage['a2r-osc/osc.js'][466] = 0;
  _$jscoverage['a2r-osc/osc.js'][467] = 0;
  _$jscoverage['a2r-osc/osc.js'][468] = 0;
  _$jscoverage['a2r-osc/osc.js'][470] = 0;
  _$jscoverage['a2r-osc/osc.js'][474] = 0;
  _$jscoverage['a2r-osc/osc.js'][475] = 0;
  _$jscoverage['a2r-osc/osc.js'][476] = 0;
  _$jscoverage['a2r-osc/osc.js'][477] = 0;
  _$jscoverage['a2r-osc/osc.js'][479] = 0;
  _$jscoverage['a2r-osc/osc.js'][480] = 0;
  _$jscoverage['a2r-osc/osc.js'][482] = 0;
  _$jscoverage['a2r-osc/osc.js'][483] = 0;
  _$jscoverage['a2r-osc/osc.js'][485] = 0;
  _$jscoverage['a2r-osc/osc.js'][486] = 0;
  _$jscoverage['a2r-osc/osc.js'][487] = 0;
  _$jscoverage['a2r-osc/osc.js'][488] = 0;
  _$jscoverage['a2r-osc/osc.js'][489] = 0;
  _$jscoverage['a2r-osc/osc.js'][492] = 0;
  _$jscoverage['a2r-osc/osc.js'][495] = 0;
  _$jscoverage['a2r-osc/osc.js'][499] = 0;
  _$jscoverage['a2r-osc/osc.js'][501] = 0;
  _$jscoverage['a2r-osc/osc.js'][502] = 0;
  _$jscoverage['a2r-osc/osc.js'][503] = 0;
  _$jscoverage['a2r-osc/osc.js'][504] = 0;
  _$jscoverage['a2r-osc/osc.js'][505] = 0;
  _$jscoverage['a2r-osc/osc.js'][507] = 0;
  _$jscoverage['a2r-osc/osc.js'][508] = 0;
  _$jscoverage['a2r-osc/osc.js'][512] = 0;
  _$jscoverage['a2r-osc/osc.js'][513] = 0;
  _$jscoverage['a2r-osc/osc.js'][514] = 0;
  _$jscoverage['a2r-osc/osc.js'][515] = 0;
  _$jscoverage['a2r-osc/osc.js'][516] = 0;
  _$jscoverage['a2r-osc/osc.js'][517] = 0;
  _$jscoverage['a2r-osc/osc.js'][519] = 0;
  _$jscoverage['a2r-osc/osc.js'][520] = 0;
  _$jscoverage['a2r-osc/osc.js'][522] = 0;
  _$jscoverage['a2r-osc/osc.js'][523] = 0;
  _$jscoverage['a2r-osc/osc.js'][524] = 0;
  _$jscoverage['a2r-osc/osc.js'][525] = 0;
  _$jscoverage['a2r-osc/osc.js'][526] = 0;
  _$jscoverage['a2r-osc/osc.js'][527] = 0;
  _$jscoverage['a2r-osc/osc.js'][528] = 0;
  _$jscoverage['a2r-osc/osc.js'][529] = 0;
  _$jscoverage['a2r-osc/osc.js'][530] = 0;
  _$jscoverage['a2r-osc/osc.js'][532] = 0;
  _$jscoverage['a2r-osc/osc.js'][533] = 0;
  _$jscoverage['a2r-osc/osc.js'][534] = 0;
  _$jscoverage['a2r-osc/osc.js'][536] = 0;
  _$jscoverage['a2r-osc/osc.js'][538] = 0;
  _$jscoverage['a2r-osc/osc.js'][541] = 0;
  _$jscoverage['a2r-osc/osc.js'][544] = 0;
  _$jscoverage['a2r-osc/osc.js'][545] = 0;
  _$jscoverage['a2r-osc/osc.js'][546] = 0;
  _$jscoverage['a2r-osc/osc.js'][547] = 0;
  _$jscoverage['a2r-osc/osc.js'][548] = 0;
  _$jscoverage['a2r-osc/osc.js'][550] = 0;
  _$jscoverage['a2r-osc/osc.js'][552] = 0;
  _$jscoverage['a2r-osc/osc.js'][553] = 0;
  _$jscoverage['a2r-osc/osc.js'][554] = 0;
  _$jscoverage['a2r-osc/osc.js'][555] = 0;
  _$jscoverage['a2r-osc/osc.js'][556] = 0;
  _$jscoverage['a2r-osc/osc.js'][557] = 0;
  _$jscoverage['a2r-osc/osc.js'][559] = 0;
  _$jscoverage['a2r-osc/osc.js'][562] = 0;
  _$jscoverage['a2r-osc/osc.js'][563] = 0;
  _$jscoverage['a2r-osc/osc.js'][564] = 0;
  _$jscoverage['a2r-osc/osc.js'][567] = 0;
  _$jscoverage['a2r-osc/osc.js'][568] = 0;
  _$jscoverage['a2r-osc/osc.js'][569] = 0;
  _$jscoverage['a2r-osc/osc.js'][571] = 0;
  _$jscoverage['a2r-osc/osc.js'][573] = 0;
  _$jscoverage['a2r-osc/osc.js'][576] = 0;
  _$jscoverage['a2r-osc/osc.js'][577] = 0;
  _$jscoverage['a2r-osc/osc.js'][578] = 0;
  _$jscoverage['a2r-osc/osc.js'][580] = 0;
  _$jscoverage['a2r-osc/osc.js'][583] = 0;
  _$jscoverage['a2r-osc/osc.js'][587] = 0;
  _$jscoverage['a2r-osc/osc.js'][588] = 0;
  _$jscoverage['a2r-osc/osc.js'][589] = 0;
  _$jscoverage['a2r-osc/osc.js'][590] = 0;
  _$jscoverage['a2r-osc/osc.js'][593] = 0;
  _$jscoverage['a2r-osc/osc.js'][594] = 0;
  _$jscoverage['a2r-osc/osc.js'][595] = 0;
  _$jscoverage['a2r-osc/osc.js'][598] = 0;
  _$jscoverage['a2r-osc/osc.js'][600] = 0;
  _$jscoverage['a2r-osc/osc.js'][602] = 0;
  _$jscoverage['a2r-osc/osc.js'][603] = 0;
  _$jscoverage['a2r-osc/osc.js'][604] = 0;
  _$jscoverage['a2r-osc/osc.js'][605] = 0;
  _$jscoverage['a2r-osc/osc.js'][606] = 0;
  _$jscoverage['a2r-osc/osc.js'][609] = 0;
  _$jscoverage['a2r-osc/osc.js'][610] = 0;
  _$jscoverage['a2r-osc/osc.js'][611] = 0;
  _$jscoverage['a2r-osc/osc.js'][612] = 0;
  _$jscoverage['a2r-osc/osc.js'][614] = 0;
  _$jscoverage['a2r-osc/osc.js'][615] = 0;
  _$jscoverage['a2r-osc/osc.js'][617] = 0;
  _$jscoverage['a2r-osc/osc.js'][618] = 0;
  _$jscoverage['a2r-osc/osc.js'][619] = 0;
  _$jscoverage['a2r-osc/osc.js'][620] = 0;
  _$jscoverage['a2r-osc/osc.js'][621] = 0;
  _$jscoverage['a2r-osc/osc.js'][623] = 0;
  _$jscoverage['a2r-osc/osc.js'][624] = 0;
  _$jscoverage['a2r-osc/osc.js'][625] = 0;
  _$jscoverage['a2r-osc/osc.js'][626] = 0;
  _$jscoverage['a2r-osc/osc.js'][627] = 0;
  _$jscoverage['a2r-osc/osc.js'][628] = 0;
  _$jscoverage['a2r-osc/osc.js'][630] = 0;
  _$jscoverage['a2r-osc/osc.js'][633] = 0;
  _$jscoverage['a2r-osc/osc.js'][634] = 0;
  _$jscoverage['a2r-osc/osc.js'][635] = 0;
  _$jscoverage['a2r-osc/osc.js'][636] = 0;
  _$jscoverage['a2r-osc/osc.js'][637] = 0;
  _$jscoverage['a2r-osc/osc.js'][638] = 0;
  _$jscoverage['a2r-osc/osc.js'][639] = 0;
  _$jscoverage['a2r-osc/osc.js'][640] = 0;
  _$jscoverage['a2r-osc/osc.js'][641] = 0;
  _$jscoverage['a2r-osc/osc.js'][643] = 0;
  _$jscoverage['a2r-osc/osc.js'][645] = 0;
  _$jscoverage['a2r-osc/osc.js'][646] = 0;
  _$jscoverage['a2r-osc/osc.js'][647] = 0;
  _$jscoverage['a2r-osc/osc.js'][648] = 0;
  _$jscoverage['a2r-osc/osc.js'][649] = 0;
  _$jscoverage['a2r-osc/osc.js'][650] = 0;
  _$jscoverage['a2r-osc/osc.js'][651] = 0;
  _$jscoverage['a2r-osc/osc.js'][653] = 0;
  _$jscoverage['a2r-osc/osc.js'][655] = 0;
  _$jscoverage['a2r-osc/osc.js'][656] = 0;
  _$jscoverage['a2r-osc/osc.js'][657] = 0;
  _$jscoverage['a2r-osc/osc.js'][658] = 0;
  _$jscoverage['a2r-osc/osc.js'][659] = 0;
  _$jscoverage['a2r-osc/osc.js'][660] = 0;
  _$jscoverage['a2r-osc/osc.js'][662] = 0;
  _$jscoverage['a2r-osc/osc.js'][666] = 0;
  _$jscoverage['a2r-osc/osc.js'][670] = 0;
  _$jscoverage['a2r-osc/osc.js'][671] = 0;
  _$jscoverage['a2r-osc/osc.js'][672] = 0;
  _$jscoverage['a2r-osc/osc.js'][673] = 0;
  _$jscoverage['a2r-osc/osc.js'][674] = 0;
  _$jscoverage['a2r-osc/osc.js'][677] = 0;
  _$jscoverage['a2r-osc/osc.js'][678] = 0;
  _$jscoverage['a2r-osc/osc.js'][679] = 0;
  _$jscoverage['a2r-osc/osc.js'][682] = 0;
  _$jscoverage['a2r-osc/osc.js'][684] = 0;
  _$jscoverage['a2r-osc/osc.js'][686] = 0;
  _$jscoverage['a2r-osc/osc.js'][687] = 0;
  _$jscoverage['a2r-osc/osc.js'][688] = 0;
  _$jscoverage['a2r-osc/osc.js'][689] = 0;
  _$jscoverage['a2r-osc/osc.js'][692] = 0;
  _$jscoverage['a2r-osc/osc.js'][693] = 0;
  _$jscoverage['a2r-osc/osc.js'][694] = 0;
  _$jscoverage['a2r-osc/osc.js'][695] = 0;
  _$jscoverage['a2r-osc/osc.js'][697] = 0;
  _$jscoverage['a2r-osc/osc.js'][698] = 0;
  _$jscoverage['a2r-osc/osc.js'][699] = 0;
  _$jscoverage['a2r-osc/osc.js'][700] = 0;
  _$jscoverage['a2r-osc/osc.js'][701] = 0;
  _$jscoverage['a2r-osc/osc.js'][702] = 0;
  _$jscoverage['a2r-osc/osc.js'][705] = 0;
  _$jscoverage['a2r-osc/osc.js'][706] = 0;
  _$jscoverage['a2r-osc/osc.js'][707] = 0;
  _$jscoverage['a2r-osc/osc.js'][708] = 0;
  _$jscoverage['a2r-osc/osc.js'][709] = 0;
  _$jscoverage['a2r-osc/osc.js'][710] = 0;
  _$jscoverage['a2r-osc/osc.js'][711] = 0;
  _$jscoverage['a2r-osc/osc.js'][712] = 0;
  _$jscoverage['a2r-osc/osc.js'][713] = 0;
  _$jscoverage['a2r-osc/osc.js'][714] = 0;
  _$jscoverage['a2r-osc/osc.js'][717] = 0;
  _$jscoverage['a2r-osc/osc.js'][718] = 0;
  _$jscoverage['a2r-osc/osc.js'][719] = 0;
  _$jscoverage['a2r-osc/osc.js'][721] = 0;
  _$jscoverage['a2r-osc/osc.js'][722] = 0;
  _$jscoverage['a2r-osc/osc.js'][723] = 0;
  _$jscoverage['a2r-osc/osc.js'][724] = 0;
  _$jscoverage['a2r-osc/osc.js'][725] = 0;
  _$jscoverage['a2r-osc/osc.js'][729] = 0;
  _$jscoverage['a2r-osc/osc.js'][733] = 0;
  _$jscoverage['a2r-osc/osc.js'][734] = 0;
  _$jscoverage['a2r-osc/osc.js'][735] = 0;
  _$jscoverage['a2r-osc/osc.js'][736] = 0;
  _$jscoverage['a2r-osc/osc.js'][737] = 0;
  _$jscoverage['a2r-osc/osc.js'][740] = 0;
  _$jscoverage['a2r-osc/osc.js'][741] = 0;
  _$jscoverage['a2r-osc/osc.js'][742] = 0;
  _$jscoverage['a2r-osc/osc.js'][745] = 0;
  _$jscoverage['a2r-osc/osc.js'][747] = 0;
  _$jscoverage['a2r-osc/osc.js'][748] = 0;
  _$jscoverage['a2r-osc/osc.js'][749] = 0;
  _$jscoverage['a2r-osc/osc.js'][751] = 0;
  _$jscoverage['a2r-osc/osc.js'][752] = 0;
  _$jscoverage['a2r-osc/osc.js'][753] = 0;
  _$jscoverage['a2r-osc/osc.js'][754] = 0;
  _$jscoverage['a2r-osc/osc.js'][756] = 0;
  _$jscoverage['a2r-osc/osc.js'][757] = 0;
  _$jscoverage['a2r-osc/osc.js'][761] = 0;
  _$jscoverage['a2r-osc/osc.js'][762] = 0;
  _$jscoverage['a2r-osc/osc.js'][763] = 0;
  _$jscoverage['a2r-osc/osc.js'][764] = 0;
  _$jscoverage['a2r-osc/osc.js'][765] = 0;
  _$jscoverage['a2r-osc/osc.js'][767] = 0;
  _$jscoverage['a2r-osc/osc.js'][771] = 0;
  _$jscoverage['a2r-osc/osc.js'][772] = 0;
  _$jscoverage['a2r-osc/osc.js'][773] = 0;
  _$jscoverage['a2r-osc/osc.js'][774] = 0;
  _$jscoverage['a2r-osc/osc.js'][776] = 0;
  _$jscoverage['a2r-osc/osc.js'][777] = 0;
  _$jscoverage['a2r-osc/osc.js'][778] = 0;
  _$jscoverage['a2r-osc/osc.js'][779] = 0;
  _$jscoverage['a2r-osc/osc.js'][780] = 0;
  _$jscoverage['a2r-osc/osc.js'][782] = 0;
  _$jscoverage['a2r-osc/osc.js'][783] = 0;
  _$jscoverage['a2r-osc/osc.js'][784] = 0;
  _$jscoverage['a2r-osc/osc.js'][785] = 0;
  _$jscoverage['a2r-osc/osc.js'][786] = 0;
  _$jscoverage['a2r-osc/osc.js'][789] = 0;
  _$jscoverage['a2r-osc/osc.js'][790] = 0;
  _$jscoverage['a2r-osc/osc.js'][792] = 0;
  _$jscoverage['a2r-osc/osc.js'][795] = 0;
  _$jscoverage['a2r-osc/osc.js'][796] = 0;
  _$jscoverage['a2r-osc/osc.js'][797] = 0;
  _$jscoverage['a2r-osc/osc.js'][798] = 0;
  _$jscoverage['a2r-osc/osc.js'][799] = 0;
  _$jscoverage['a2r-osc/osc.js'][800] = 0;
  _$jscoverage['a2r-osc/osc.js'][801] = 0;
  _$jscoverage['a2r-osc/osc.js'][802] = 0;
  _$jscoverage['a2r-osc/osc.js'][804] = 0;
  _$jscoverage['a2r-osc/osc.js'][807] = 0;
  _$jscoverage['a2r-osc/osc.js'][808] = 0;
  _$jscoverage['a2r-osc/osc.js'][809] = 0;
  _$jscoverage['a2r-osc/osc.js'][810] = 0;
  _$jscoverage['a2r-osc/osc.js'][811] = 0;
  _$jscoverage['a2r-osc/osc.js'][812] = 0;
  _$jscoverage['a2r-osc/osc.js'][813] = 0;
  _$jscoverage['a2r-osc/osc.js'][815] = 0;
  _$jscoverage['a2r-osc/osc.js'][816] = 0;
  _$jscoverage['a2r-osc/osc.js'][817] = 0;
  _$jscoverage['a2r-osc/osc.js'][818] = 0;
  _$jscoverage['a2r-osc/osc.js'][820] = 0;
  _$jscoverage['a2r-osc/osc.js'][822] = 0;
  _$jscoverage['a2r-osc/osc.js'][825] = 0;
  _$jscoverage['a2r-osc/osc.js'][826] = 0;
  _$jscoverage['a2r-osc/osc.js'][827] = 0;
  _$jscoverage['a2r-osc/osc.js'][828] = 0;
  _$jscoverage['a2r-osc/osc.js'][829] = 0;
  _$jscoverage['a2r-osc/osc.js'][831] = 0;
  _$jscoverage['a2r-osc/osc.js'][833] = 0;
  _$jscoverage['a2r-osc/osc.js'][836] = 0;
  _$jscoverage['a2r-osc/osc.js'][837] = 0;
  _$jscoverage['a2r-osc/osc.js'][840] = 0;
  _$jscoverage['a2r-osc/osc.js'][841] = 0;
  _$jscoverage['a2r-osc/osc.js'][844] = 0;
  _$jscoverage['a2r-osc/osc.js'][845] = 0;
  _$jscoverage['a2r-osc/osc.js'][848] = 0;
  _$jscoverage['a2r-osc/osc.js'][852] = 0;
  _$jscoverage['a2r-osc/osc.js'][853] = 0;
  _$jscoverage['a2r-osc/osc.js'][854] = 0;
  _$jscoverage['a2r-osc/osc.js'][855] = 0;
  _$jscoverage['a2r-osc/osc.js'][858] = 0;
  _$jscoverage['a2r-osc/osc.js'][859] = 0;
  _$jscoverage['a2r-osc/osc.js'][860] = 0;
  _$jscoverage['a2r-osc/osc.js'][863] = 0;
  _$jscoverage['a2r-osc/osc.js'][865] = 0;
  _$jscoverage['a2r-osc/osc.js'][867] = 0;
  _$jscoverage['a2r-osc/osc.js'][868] = 0;
  _$jscoverage['a2r-osc/osc.js'][869] = 0;
  _$jscoverage['a2r-osc/osc.js'][872] = 0;
  _$jscoverage['a2r-osc/osc.js'][873] = 0;
  _$jscoverage['a2r-osc/osc.js'][876] = 0;
  _$jscoverage['a2r-osc/osc.js'][877] = 0;
  _$jscoverage['a2r-osc/osc.js'][878] = 0;
  _$jscoverage['a2r-osc/osc.js'][879] = 0;
  _$jscoverage['a2r-osc/osc.js'][880] = 0;
  _$jscoverage['a2r-osc/osc.js'][881] = 0;
  _$jscoverage['a2r-osc/osc.js'][882] = 0;
  _$jscoverage['a2r-osc/osc.js'][883] = 0;
  _$jscoverage['a2r-osc/osc.js'][885] = 0;
  _$jscoverage['a2r-osc/osc.js'][888] = 0;
  _$jscoverage['a2r-osc/osc.js'][889] = 0;
  _$jscoverage['a2r-osc/osc.js'][890] = 0;
  _$jscoverage['a2r-osc/osc.js'][891] = 0;
  _$jscoverage['a2r-osc/osc.js'][893] = 0;
  _$jscoverage['a2r-osc/osc.js'][894] = 0;
  _$jscoverage['a2r-osc/osc.js'][895] = 0;
  _$jscoverage['a2r-osc/osc.js'][896] = 0;
  _$jscoverage['a2r-osc/osc.js'][897] = 0;
  _$jscoverage['a2r-osc/osc.js'][898] = 0;
  _$jscoverage['a2r-osc/osc.js'][900] = 0;
  _$jscoverage['a2r-osc/osc.js'][901] = 0;
  _$jscoverage['a2r-osc/osc.js'][902] = 0;
  _$jscoverage['a2r-osc/osc.js'][903] = 0;
  _$jscoverage['a2r-osc/osc.js'][905] = 0;
  _$jscoverage['a2r-osc/osc.js'][907] = 0;
  _$jscoverage['a2r-osc/osc.js'][910] = 0;
  _$jscoverage['a2r-osc/osc.js'][911] = 0;
  _$jscoverage['a2r-osc/osc.js'][912] = 0;
  _$jscoverage['a2r-osc/osc.js'][913] = 0;
  _$jscoverage['a2r-osc/osc.js'][915] = 0;
  _$jscoverage['a2r-osc/osc.js'][916] = 0;
  _$jscoverage['a2r-osc/osc.js'][918] = 0;
  _$jscoverage['a2r-osc/osc.js'][919] = 0;
  _$jscoverage['a2r-osc/osc.js'][921] = 0;
  _$jscoverage['a2r-osc/osc.js'][922] = 0;
  _$jscoverage['a2r-osc/osc.js'][923] = 0;
  _$jscoverage['a2r-osc/osc.js'][924] = 0;
  _$jscoverage['a2r-osc/osc.js'][925] = 0;
  _$jscoverage['a2r-osc/osc.js'][926] = 0;
  _$jscoverage['a2r-osc/osc.js'][928] = 0;
  _$jscoverage['a2r-osc/osc.js'][930] = 0;
  _$jscoverage['a2r-osc/osc.js'][931] = 0;
  _$jscoverage['a2r-osc/osc.js'][933] = 0;
  _$jscoverage['a2r-osc/osc.js'][934] = 0;
  _$jscoverage['a2r-osc/osc.js'][935] = 0;
  _$jscoverage['a2r-osc/osc.js'][936] = 0;
  _$jscoverage['a2r-osc/osc.js'][938] = 0;
  _$jscoverage['a2r-osc/osc.js'][940] = 0;
  _$jscoverage['a2r-osc/osc.js'][941] = 0;
  _$jscoverage['a2r-osc/osc.js'][942] = 0;
  _$jscoverage['a2r-osc/osc.js'][944] = 0;
  _$jscoverage['a2r-osc/osc.js'][947] = 0;
  _$jscoverage['a2r-osc/osc.js'][951] = 0;
  _$jscoverage['a2r-osc/osc.js'][952] = 0;
  _$jscoverage['a2r-osc/osc.js'][953] = 0;
  _$jscoverage['a2r-osc/osc.js'][954] = 0;
  _$jscoverage['a2r-osc/osc.js'][955] = 0;
  _$jscoverage['a2r-osc/osc.js'][957] = 0;
  _$jscoverage['a2r-osc/osc.js'][958] = 0;
  _$jscoverage['a2r-osc/osc.js'][959] = 0;
  _$jscoverage['a2r-osc/osc.js'][961] = 0;
  _$jscoverage['a2r-osc/osc.js'][964] = 0;
  _$jscoverage['a2r-osc/osc.js'][965] = 0;
  _$jscoverage['a2r-osc/osc.js'][966] = 0;
  _$jscoverage['a2r-osc/osc.js'][969] = 0;
  _$jscoverage['a2r-osc/osc.js'][971] = 0;
  _$jscoverage['a2r-osc/osc.js'][973] = 0;
  _$jscoverage['a2r-osc/osc.js'][974] = 0;
  _$jscoverage['a2r-osc/osc.js'][977] = 0;
  _$jscoverage['a2r-osc/osc.js'][978] = 0;
  _$jscoverage['a2r-osc/osc.js'][981] = 0;
  _$jscoverage['a2r-osc/osc.js'][982] = 0;
  _$jscoverage['a2r-osc/osc.js'][985] = 0;
  _$jscoverage['a2r-osc/osc.js'][986] = 0;
  _$jscoverage['a2r-osc/osc.js'][987] = 0;
  _$jscoverage['a2r-osc/osc.js'][988] = 0;
  _$jscoverage['a2r-osc/osc.js'][990] = 0;
  _$jscoverage['a2r-osc/osc.js'][991] = 0;
  _$jscoverage['a2r-osc/osc.js'][992] = 0;
  _$jscoverage['a2r-osc/osc.js'][993] = 0;
  _$jscoverage['a2r-osc/osc.js'][994] = 0;
  _$jscoverage['a2r-osc/osc.js'][995] = 0;
  _$jscoverage['a2r-osc/osc.js'][996] = 0;
  _$jscoverage['a2r-osc/osc.js'][998] = 0;
  _$jscoverage['a2r-osc/osc.js'][1000] = 0;
  _$jscoverage['a2r-osc/osc.js'][1003] = 0;
  _$jscoverage['a2r-osc/osc.js'][1004] = 0;
  _$jscoverage['a2r-osc/osc.js'][1005] = 0;
  _$jscoverage['a2r-osc/osc.js'][1006] = 0;
  _$jscoverage['a2r-osc/osc.js'][1008] = 0;
  _$jscoverage['a2r-osc/osc.js'][1009] = 0;
  _$jscoverage['a2r-osc/osc.js'][1011] = 0;
  _$jscoverage['a2r-osc/osc.js'][1012] = 0;
  _$jscoverage['a2r-osc/osc.js'][1014] = 0;
  _$jscoverage['a2r-osc/osc.js'][1015] = 0;
  _$jscoverage['a2r-osc/osc.js'][1016] = 0;
  _$jscoverage['a2r-osc/osc.js'][1017] = 0;
  _$jscoverage['a2r-osc/osc.js'][1018] = 0;
  _$jscoverage['a2r-osc/osc.js'][1019] = 0;
  _$jscoverage['a2r-osc/osc.js'][1021] = 0;
  _$jscoverage['a2r-osc/osc.js'][1023] = 0;
  _$jscoverage['a2r-osc/osc.js'][1024] = 0;
  _$jscoverage['a2r-osc/osc.js'][1026] = 0;
  _$jscoverage['a2r-osc/osc.js'][1027] = 0;
  _$jscoverage['a2r-osc/osc.js'][1028] = 0;
  _$jscoverage['a2r-osc/osc.js'][1029] = 0;
  _$jscoverage['a2r-osc/osc.js'][1031] = 0;
  _$jscoverage['a2r-osc/osc.js'][1033] = 0;
  _$jscoverage['a2r-osc/osc.js'][1034] = 0;
  _$jscoverage['a2r-osc/osc.js'][1035] = 0;
  _$jscoverage['a2r-osc/osc.js'][1037] = 0;
  _$jscoverage['a2r-osc/osc.js'][1040] = 0;
  _$jscoverage['a2r-osc/osc.js'][1044] = 0;
  _$jscoverage['a2r-osc/osc.js'][1045] = 0;
  _$jscoverage['a2r-osc/osc.js'][1046] = 0;
  _$jscoverage['a2r-osc/osc.js'][1047] = 0;
  _$jscoverage['a2r-osc/osc.js'][1048] = 0;
  _$jscoverage['a2r-osc/osc.js'][1050] = 0;
  _$jscoverage['a2r-osc/osc.js'][1051] = 0;
  _$jscoverage['a2r-osc/osc.js'][1052] = 0;
  _$jscoverage['a2r-osc/osc.js'][1054] = 0;
  _$jscoverage['a2r-osc/osc.js'][1057] = 0;
  _$jscoverage['a2r-osc/osc.js'][1058] = 0;
  _$jscoverage['a2r-osc/osc.js'][1059] = 0;
  _$jscoverage['a2r-osc/osc.js'][1062] = 0;
  _$jscoverage['a2r-osc/osc.js'][1063] = 0;
  _$jscoverage['a2r-osc/osc.js'][1064] = 0;
  _$jscoverage['a2r-osc/osc.js'][1066] = 0;
  _$jscoverage['a2r-osc/osc.js'][1070] = 0;
  _$jscoverage['a2r-osc/osc.js'][1072] = 0;
  _$jscoverage['a2r-osc/osc.js'][1074] = 0;
  _$jscoverage['a2r-osc/osc.js'][1076] = 0;
  _$jscoverage['a2r-osc/osc.js'][1078] = 0;
  _$jscoverage['a2r-osc/osc.js'][1080] = 0;
  _$jscoverage['a2r-osc/osc.js'][1082] = 0;
  _$jscoverage['a2r-osc/osc.js'][1084] = 0;
  _$jscoverage['a2r-osc/osc.js'][1086] = 0;
  _$jscoverage['a2r-osc/osc.js'][1088] = 0;
  _$jscoverage['a2r-osc/osc.js'][1090] = 0;
  _$jscoverage['a2r-osc/osc.js'][1092] = 0;
  _$jscoverage['a2r-osc/osc.js'][1094] = 0;
}
_$jscoverage['a2r-osc/osc.js'][2]++;
(function () {
  _$jscoverage['a2r-osc/osc.js'][3]++;
  var AbstractOscPacketGenerator, AbstractOscPacketParser, Bundle, Impulse, Message, NUMBERS, OSC_TYPES, OSC_TYPES_BY_NAME, OscArrayBufferPacketGenerator, OscArrayBufferPacketParser, OscBufferPacketGenerator, OscBufferPacketParser, SECONDS_FROM_1900_to_1970, code, desc, exports, fromBuffer, fromNTP, name, nodeBuffer, oscPadding, oscSizeOf, oscSizeOfBlob, oscSizeOfBundle, oscSizeOfMessage, oscSizeOfString, oscTypeCodeOf, toInteger, toNTP, toNumber, type, _fn, _fn1, _fn2, _fn3, _fn4, _fn5, __hasProp = ({}).hasOwnProperty, __extends = (function (child, parent) {
  _$jscoverage['a2r-osc/osc.js'][5]++;
  for (var key in parent) {
    _$jscoverage['a2r-osc/osc.js'][5]++;
    if (__hasProp.call(parent, key)) {
      _$jscoverage['a2r-osc/osc.js'][5]++;
      child[key] = parent[key];
    }
}
  _$jscoverage['a2r-osc/osc.js'][5]++;
  function ctor() {
    _$jscoverage['a2r-osc/osc.js'][5]++;
    this.constructor = child;
}
  _$jscoverage['a2r-osc/osc.js'][5]++;
  ctor.prototype = parent.prototype;
  _$jscoverage['a2r-osc/osc.js'][5]++;
  child.prototype = new ctor();
  _$jscoverage['a2r-osc/osc.js'][5]++;
  child.__super__ = parent.prototype;
  _$jscoverage['a2r-osc/osc.js'][5]++;
  return child;
});
  _$jscoverage['a2r-osc/osc.js'][7]++;
  nodeBuffer = typeof Buffer === "function";
  _$jscoverage['a2r-osc/osc.js'][9]++;
  toNumber = (function (val) {
  _$jscoverage['a2r-osc/osc.js'][10]++;
  val = Number(val);
  _$jscoverage['a2r-osc/osc.js'][11]++;
  if (val === NaN) {
    _$jscoverage['a2r-osc/osc.js'][12]++;
    throw new Error("Value isn't a number");
  }
  _$jscoverage['a2r-osc/osc.js'][14]++;
  return val;
});
  _$jscoverage['a2r-osc/osc.js'][17]++;
  toInteger = (function (val) {
  _$jscoverage['a2r-osc/osc.js'][18]++;
  val = toNumber(val);
  _$jscoverage['a2r-osc/osc.js'][19]++;
  return Math.round(val);
});
  _$jscoverage['a2r-osc/osc.js'][22]++;
  SECONDS_FROM_1900_to_1970 = 2208988800;
  _$jscoverage['a2r-osc/osc.js'][24]++;
  fromNTP = (function (seconds, fraction) {
  _$jscoverage['a2r-osc/osc.js'][25]++;
  var date, ms;
  _$jscoverage['a2r-osc/osc.js'][26]++;
  if (seconds === 0 && fraction === 1) {
    _$jscoverage['a2r-osc/osc.js'][27]++;
    return new Date();
  }
  _$jscoverage['a2r-osc/osc.js'][29]++;
  ms = (seconds - SECONDS_FROM_1900_to_1970) * 1000;
  _$jscoverage['a2r-osc/osc.js'][30]++;
  ms += Math.round(1000 * fraction / 4294967296);
  _$jscoverage['a2r-osc/osc.js'][31]++;
  date = new Date(ms);
  _$jscoverage['a2r-osc/osc.js'][32]++;
  date.ntpSeconds = seconds;
  _$jscoverage['a2r-osc/osc.js'][33]++;
  date.ntpFraction = fraction;
  _$jscoverage['a2r-osc/osc.js'][34]++;
  return date;
});
  _$jscoverage['a2r-osc/osc.js'][37]++;
  toNTP = (function (date) {
  _$jscoverage['a2r-osc/osc.js'][38]++;
  var fraction, seconds, time;
  _$jscoverage['a2r-osc/osc.js'][39]++;
  if (date === 1) {
    _$jscoverage['a2r-osc/osc.js'][40]++;
    return [0, 1];
  }
  _$jscoverage['a2r-osc/osc.js'][42]++;
  if (Array.isArray(date)) {
    _$jscoverage['a2r-osc/osc.js'][43]++;
    return date;
  }
  _$jscoverage['a2r-osc/osc.js'][45]++;
  time = date.getTime();
  _$jscoverage['a2r-osc/osc.js'][46]++;
  seconds = Math.floor(time / 1000);
  _$jscoverage['a2r-osc/osc.js'][47]++;
  fraction = Math.round(((time % 1000) * 4294967296) / 1000);
  _$jscoverage['a2r-osc/osc.js'][48]++;
  return [seconds + SECONDS_FROM_1900_to_1970, fraction];
});
  _$jscoverage['a2r-osc/osc.js'][51]++;
  OSC_TYPES = {i: {name: "integer", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][55]++;
  return reader.readInt32();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][58]++;
  return writer.writeInt32(value);
}), cast: toInteger, sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][62]++;
  return 4;
})}, f: {name: "float", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][68]++;
  return reader.readFloat();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][71]++;
  return writer.writeFloat(value);
}), cast: toNumber, sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][75]++;
  return 4;
})}, s: {name: "string", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][81]++;
  return reader.readString();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][84]++;
  return writer.writeString(value);
}), cast: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][87]++;
  return value.toString();
}), sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][90]++;
  return oscSizeOfString(value.toString());
})}, b: {name: "blob", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][96]++;
  return reader.readBlob();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][99]++;
  return writer.writeBlob(value);
}), sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][102]++;
  return oscSizeOfBlob(value);
})}, d: {name: "double", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][108]++;
  return reader.readDouble();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][111]++;
  return writer.writeDouble(value);
}), sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][114]++;
  return 8;
})}, c: {name: "char", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][120]++;
  return String.fromCharCode(reader.readInt32() & 127);
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][123]++;
  return writer.writeInt32(value.charCodeAt(0));
}), cast: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][126]++;
  return value.toString().charAt(0);
}), sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][129]++;
  return 4;
})}, r: {name: "color", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][135]++;
  return reader.readInt32();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][138]++;
  return writer.writeInt32(value);
}), cast: toInteger, sizeOf: (function (value) {
  _$jscoverage['a2r-osc/osc.js'][142]++;
  return 4;
})}, t: {name: "time", read: (function (reader) {
  _$jscoverage['a2r-osc/osc.js'][148]++;
  return reader.readTimetag();
}), write: (function (writer, value) {
  _$jscoverage['a2r-osc/osc.js'][151]++;
  return writer.writeTimetag(value);
}), cast: toNTP, sizeOf: (function () {
  _$jscoverage['a2r-osc/osc.js'][155]++;
  return 8;
})}, T: {name: "true", read: (function () {
  _$jscoverage['a2r-osc/osc.js'][161]++;
  return true;
})}, F: {name: "false", read: (function () {
  _$jscoverage['a2r-osc/osc.js'][167]++;
  return false;
})}, N: {name: "null", read: (function () {
  _$jscoverage['a2r-osc/osc.js'][173]++;
  return null;
})}, I: {name: "impulse", read: (function () {
  _$jscoverage['a2r-osc/osc.js'][179]++;
  return Impulse;
})}};
  _$jscoverage['a2r-osc/osc.js'][184]++;
  OSC_TYPES.S = OSC_TYPES.s;
  _$jscoverage['a2r-osc/osc.js'][186]++;
  OSC_TYPES_BY_NAME = {};
  _$jscoverage['a2r-osc/osc.js'][188]++;
  for (code in OSC_TYPES) {
    _$jscoverage['a2r-osc/osc.js'][189]++;
    type = OSC_TYPES[code];
    _$jscoverage['a2r-osc/osc.js'][190]++;
    if (code !== "S") {
      _$jscoverage['a2r-osc/osc.js'][191]++;
      type.code = code;
    }
    _$jscoverage['a2r-osc/osc.js'][193]++;
    OSC_TYPES_BY_NAME[type.name] = type;
}
  _$jscoverage['a2r-osc/osc.js'][196]++;
  NUMBERS = {Int32: {dataViewReader: "getInt32", dataViewWriter: "setInt32", bufferReader: "readInt32BE", bufferWriter: "writeInt32BE", size: 4}, UInt32: {dataViewReader: "getUint32", dataViewWriter: "setUint32", bufferReader: "readUInt32BE", bufferWriter: "writeUInt32BE", size: 4}, Float: {dataViewReader: "getFloat32", dataViewWriter: "setFloat32", bufferReader: "readFloatBE", bufferWriter: "writeFloatBE", size: 4}, Double: {dataViewReader: "getFloat64", dataViewWriter: "setFloat64", bufferReader: "readDoubleBE", bufferWriter: "writeDoubleBE", size: 8}};
  _$jscoverage['a2r-osc/osc.js'][227]++;
  oscPadding = (function (len) {
  _$jscoverage['a2r-osc/osc.js'][228]++;
  return 4 - len % 4;
});
  _$jscoverage['a2r-osc/osc.js'][231]++;
  Impulse = new Object();
  _$jscoverage['a2r-osc/osc.js'][233]++;
  oscTypeCodeOf = (function (val) {
  _$jscoverage['a2r-osc/osc.js'][234]++;
  switch (typeof val) {
  case "string":
    _$jscoverage['a2r-osc/osc.js'][236]++;
    return "s";
  case "number":
    _$jscoverage['a2r-osc/osc.js'][238]++;
    return "f";
  case "boolean":
    _$jscoverage['a2r-osc/osc.js'][240]++;
    if (val) {
      _$jscoverage['a2r-osc/osc.js'][241]++;
      return "T";
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][243]++;
      return "F";
    }
    _$jscoverage['a2r-osc/osc.js'][245]++;
    break;
  case "undefined":
    _$jscoverage['a2r-osc/osc.js'][247]++;
    throw new Error("Value can't be undefined");
    _$jscoverage['a2r-osc/osc.js'][248]++;
    break;
  case "object":
    _$jscoverage['a2r-osc/osc.js'][250]++;
    if (val === null) {
      _$jscoverage['a2r-osc/osc.js'][251]++;
      return "N";
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][252]++;
      if (val instanceof Date) {
        _$jscoverage['a2r-osc/osc.js'][253]++;
        return "t";
      }
      else {
        _$jscoverage['a2r-osc/osc.js'][254]++;
        if ((nodeBuffer && Buffer.isBuffer(val)) || val instanceof ArrayBuffer) {
          _$jscoverage['a2r-osc/osc.js'][255]++;
          return "b";
        }
        else {
          _$jscoverage['a2r-osc/osc.js'][256]++;
          if (val === Impulse) {
            _$jscoverage['a2r-osc/osc.js'][257]++;
            return "I";
          }
          else {
            _$jscoverage['a2r-osc/osc.js'][259]++;
            throw new Error("Unsupported type `" + val + "`");
          }
        }
      }
    }
    _$jscoverage['a2r-osc/osc.js'][261]++;
    break;
  default:
    _$jscoverage['a2r-osc/osc.js'][263]++;
    throw new Error("Unsupported type `" + val + "`");
  }
});
  _$jscoverage['a2r-osc/osc.js'][267]++;
  oscSizeOfString = (function (str) {
  _$jscoverage['a2r-osc/osc.js'][268]++;
  return str.length + oscPadding(str.length);
});
  _$jscoverage['a2r-osc/osc.js'][271]++;
  oscSizeOfBlob = (function (buf) {
  _$jscoverage['a2r-osc/osc.js'][272]++;
  var length, pad;
  _$jscoverage['a2r-osc/osc.js'][273]++;
  if (buf instanceof ArrayBuffer) {
    _$jscoverage['a2r-osc/osc.js'][274]++;
    length = 4 + buf.byteLength;
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][276]++;
    length = 4 + buf.length;
  }
  _$jscoverage['a2r-osc/osc.js'][278]++;
  pad = oscPadding(length);
  _$jscoverage['a2r-osc/osc.js'][279]++;
  if (pad < 4) {
    _$jscoverage['a2r-osc/osc.js'][280]++;
    length += pad;
  }
  _$jscoverage['a2r-osc/osc.js'][282]++;
  return length;
});
  _$jscoverage['a2r-osc/osc.js'][285]++;
  oscSizeOfBundle = (function (bundle, dict) {
  _$jscoverage['a2r-osc/osc.js'][286]++;
  var elem, size, _i, _len, _ref;
  _$jscoverage['a2r-osc/osc.js'][287]++;
  size = 16;
  _$jscoverage['a2r-osc/osc.js'][288]++;
  _ref = bundle.elements;
  _$jscoverage['a2r-osc/osc.js'][289]++;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    _$jscoverage['a2r-osc/osc.js'][290]++;
    elem = _ref[_i];
    _$jscoverage['a2r-osc/osc.js'][291]++;
    size += 4 + oscSizeOfMessage(elem, dict);
}
  _$jscoverage['a2r-osc/osc.js'][293]++;
  return size;
});
  _$jscoverage['a2r-osc/osc.js'][296]++;
  oscSizeOfMessage = (function (msg, dict) {
  _$jscoverage['a2r-osc/osc.js'][297]++;
  var addressId, i, l, size, tl, typeCode, value;
  _$jscoverage['a2r-osc/osc.js'][298]++;
  addressId = dict != null? dict[msg.address]: void 0;
  _$jscoverage['a2r-osc/osc.js'][299]++;
  if (addressId) {
    _$jscoverage['a2r-osc/osc.js'][300]++;
    size = 8;
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][302]++;
    size = oscSizeOfString(msg.address);
  }
  _$jscoverage['a2r-osc/osc.js'][304]++;
  if (addressId) {
    _$jscoverage['a2r-osc/osc.js'][305]++;
    tl = msg.typeTag.length + 2;
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][307]++;
    tl = msg.typeTag.length + 1;
  }
  _$jscoverage['a2r-osc/osc.js'][309]++;
  size += tl + oscPadding(tl);
  _$jscoverage['a2r-osc/osc.js'][310]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][311]++;
  l = msg.typeTag.length;
  _$jscoverage['a2r-osc/osc.js'][312]++;
  while (i < l) {
    _$jscoverage['a2r-osc/osc.js'][313]++;
    typeCode = msg.typeTag.charAt(i);
    _$jscoverage['a2r-osc/osc.js'][314]++;
    value = msg.arguments[i++];
    _$jscoverage['a2r-osc/osc.js'][315]++;
    size += oscSizeOf(value, typeCode);
}
  _$jscoverage['a2r-osc/osc.js'][317]++;
  return size;
});
  _$jscoverage['a2r-osc/osc.js'][320]++;
  oscSizeOf = (function (value, code) {
  _$jscoverage['a2r-osc/osc.js'][321]++;
  if (code) {
    _$jscoverage['a2r-osc/osc.js'][322]++;
    type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
    _$jscoverage['a2r-osc/osc.js'][323]++;
    if (! type) {
      _$jscoverage['a2r-osc/osc.js'][324]++;
      throw new Error("Type `" + code + "` isn't supported");
    }
    _$jscoverage['a2r-osc/osc.js'][326]++;
    if (! type.sizeOf) {
      _$jscoverage['a2r-osc/osc.js'][327]++;
      return 0;
    }
    _$jscoverage['a2r-osc/osc.js'][329]++;
    return type.sizeOf(value);
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][331]++;
    code = oscTypeCodeOf(value);
    _$jscoverage['a2r-osc/osc.js'][332]++;
    return oscSizeOf(value, code);
  }
});
  _$jscoverage['a2r-osc/osc.js'][336]++;
  Message = (function () {
  _$jscoverage['a2r-osc/osc.js'][338]++;
  function Message(address, typeTag, args) {
    _$jscoverage['a2r-osc/osc.js'][339]++;
    var value;
    _$jscoverage['a2r-osc/osc.js'][340]++;
    this.address = address;
    _$jscoverage['a2r-osc/osc.js'][341]++;
    if (typeTag && ! (args != null)) {
      _$jscoverage['a2r-osc/osc.js'][342]++;
      args = typeTag;
      _$jscoverage['a2r-osc/osc.js'][343]++;
      typeTag = null;
    }
    _$jscoverage['a2r-osc/osc.js'][345]++;
    if (! Array.isArray(args)) {
      _$jscoverage['a2r-osc/osc.js'][346]++;
      args = [args];
    }
    _$jscoverage['a2r-osc/osc.js'][348]++;
    if (typeTag) {
      _$jscoverage['a2r-osc/osc.js'][349]++;
      this.typeTag = typeTag;
      _$jscoverage['a2r-osc/osc.js'][350]++;
      this.arguments = args;
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][352]++;
      this.typeTag = "";
      _$jscoverage['a2r-osc/osc.js'][353]++;
      this.arguments = (function () {
  _$jscoverage['a2r-osc/osc.js'][354]++;
  var _i, _len, _results;
  _$jscoverage['a2r-osc/osc.js'][355]++;
  _results = [];
  _$jscoverage['a2r-osc/osc.js'][356]++;
  for (_i = 0, _len = args.length; _i < _len; _i++) {
    _$jscoverage['a2r-osc/osc.js'][357]++;
    value = args[_i];
    _$jscoverage['a2r-osc/osc.js'][358]++;
    if (typeof value === "object" && ((value != null? value.type: void 0) != null)) {
      _$jscoverage['a2r-osc/osc.js'][359]++;
      code = value.type;
      _$jscoverage['a2r-osc/osc.js'][360]++;
      type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
      _$jscoverage['a2r-osc/osc.js'][361]++;
      if (! type) {
        _$jscoverage['a2r-osc/osc.js'][362]++;
        throw new Error("Type `" + code + "` isn't supported");
      }
      _$jscoverage['a2r-osc/osc.js'][364]++;
      this.typeTag += type.code;
      _$jscoverage['a2r-osc/osc.js'][365]++;
      if (type.sizeOf) {
        _$jscoverage['a2r-osc/osc.js'][366]++;
        _results.push(value.value);
      }
      else {
        _$jscoverage['a2r-osc/osc.js'][368]++;
        _results.push(type.read());
      }
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][371]++;
      this.typeTag += oscTypeCodeOf(value);
      _$jscoverage['a2r-osc/osc.js'][372]++;
      _results.push(value);
    }
}
  _$jscoverage['a2r-osc/osc.js'][375]++;
  return _results;
}).call(this);
    }
    _$jscoverage['a2r-osc/osc.js'][378]++;
    if (this.arguments.length !== this.typeTag.length) {
      _$jscoverage['a2r-osc/osc.js'][379]++;
      throw new Error("Arguments doesn't match typetag");
    }
}
  _$jscoverage['a2r-osc/osc.js'][383]++;
  Message.prototype.toBuffer = (function (dict) {
  _$jscoverage['a2r-osc/osc.js'][384]++;
  if (nodeBuffer) {
    _$jscoverage['a2r-osc/osc.js'][385]++;
    return new OscBufferPacketGenerator(this, dict).generate();
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][387]++;
    return new OscArrayBufferPacketGenerator(this, dict).generate();
  }
});
  _$jscoverage['a2r-osc/osc.js'][391]++;
  Message.prototype.equal = (function (other) {
  _$jscoverage['a2r-osc/osc.js'][392]++;
  var arg, i, _i, _len, _ref;
  _$jscoverage['a2r-osc/osc.js'][393]++;
  if (! (other instanceof Message)) {
    _$jscoverage['a2r-osc/osc.js'][394]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][396]++;
  if (other.address !== this.address) {
    _$jscoverage['a2r-osc/osc.js'][397]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][399]++;
  if (other.typeTag !== this.typeTag) {
    _$jscoverage['a2r-osc/osc.js'][400]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][402]++;
  if (other.arguments.length !== this.arguments.length) {
    _$jscoverage['a2r-osc/osc.js'][403]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][405]++;
  _ref = this.arguments;
  _$jscoverage['a2r-osc/osc.js'][406]++;
  for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
    _$jscoverage['a2r-osc/osc.js'][407]++;
    arg = _ref[i];
    _$jscoverage['a2r-osc/osc.js'][408]++;
    if (other.arguments[i] !== arg) {
      _$jscoverage['a2r-osc/osc.js'][409]++;
      return false;
    }
}
  _$jscoverage['a2r-osc/osc.js'][412]++;
  return true;
});
  _$jscoverage['a2r-osc/osc.js'][415]++;
  return Message;
})();
  _$jscoverage['a2r-osc/osc.js'][419]++;
  Bundle = (function () {
  _$jscoverage['a2r-osc/osc.js'][421]++;
  function Bundle(timetag, elements) {
    _$jscoverage['a2r-osc/osc.js'][422]++;
    var elem, _i, _len, _ref;
    _$jscoverage['a2r-osc/osc.js'][423]++;
    if (timetag instanceof Date) {
      _$jscoverage['a2r-osc/osc.js'][424]++;
      this.timetag = timetag;
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][425]++;
      if (timetag === 1) {
        _$jscoverage['a2r-osc/osc.js'][426]++;
        this.timetag = new Date();
      }
      else {
        _$jscoverage['a2r-osc/osc.js'][428]++;
        this.timetag = new Date();
        _$jscoverage['a2r-osc/osc.js'][429]++;
        elements = timetag;
      }
    }
    _$jscoverage['a2r-osc/osc.js'][431]++;
    if (elements) {
      _$jscoverage['a2r-osc/osc.js'][432]++;
      if (! Array.isArray(elements)) {
        _$jscoverage['a2r-osc/osc.js'][433]++;
        elements = [elements];
      }
      _$jscoverage['a2r-osc/osc.js'][435]++;
      this.elements = elements;
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][437]++;
      this.elements = [];
    }
    _$jscoverage['a2r-osc/osc.js'][439]++;
    _ref = this.elements;
    _$jscoverage['a2r-osc/osc.js'][440]++;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _$jscoverage['a2r-osc/osc.js'][441]++;
      elem = _ref[_i];
      _$jscoverage['a2r-osc/osc.js'][442]++;
      if (! elem instanceof Message) {
        _$jscoverage['a2r-osc/osc.js'][443]++;
        throw new Error("A bundle element must be an instance of Message");
      }
}
    _$jscoverage['a2r-osc/osc.js'][446]++;
    null;
}
  _$jscoverage['a2r-osc/osc.js'][449]++;
  Bundle.prototype.addElement = (function (address, typeTag, args) {
  _$jscoverage['a2r-osc/osc.js'][450]++;
  var msg;
  _$jscoverage['a2r-osc/osc.js'][451]++;
  if (address instanceof Message) {
    _$jscoverage['a2r-osc/osc.js'][452]++;
    this.elements.push(address);
    _$jscoverage['a2r-osc/osc.js'][453]++;
    return address;
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][455]++;
    msg = new Message(address, typeTag, args);
    _$jscoverage['a2r-osc/osc.js'][456]++;
    this.elements.push(msg);
    _$jscoverage['a2r-osc/osc.js'][457]++;
    return msg;
  }
});
  _$jscoverage['a2r-osc/osc.js'][461]++;
  Bundle.prototype.message = (function (address, typeTag, args) {
  _$jscoverage['a2r-osc/osc.js'][462]++;
  this.addElement(address, typeTag, args);
  _$jscoverage['a2r-osc/osc.js'][463]++;
  return this;
});
  _$jscoverage['a2r-osc/osc.js'][466]++;
  Bundle.prototype.toBuffer = (function (dict) {
  _$jscoverage['a2r-osc/osc.js'][467]++;
  if (nodeBuffer) {
    _$jscoverage['a2r-osc/osc.js'][468]++;
    return new OscBufferPacketGenerator(this, dict).generate();
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][470]++;
    return new OscArrayBufferPacketGenerator(this, dict).generate();
  }
});
  _$jscoverage['a2r-osc/osc.js'][474]++;
  Bundle.prototype.equal = (function (other) {
  _$jscoverage['a2r-osc/osc.js'][475]++;
  var elem, i, _i, _len, _ref;
  _$jscoverage['a2r-osc/osc.js'][476]++;
  if (! (other instanceof Bundle)) {
    _$jscoverage['a2r-osc/osc.js'][477]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][479]++;
  if (other.timetag !== this.timetag) {
    _$jscoverage['a2r-osc/osc.js'][480]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][482]++;
  if (other.elements.length !== this.elements.length) {
    _$jscoverage['a2r-osc/osc.js'][483]++;
    return false;
  }
  _$jscoverage['a2r-osc/osc.js'][485]++;
  _ref = this.elements;
  _$jscoverage['a2r-osc/osc.js'][486]++;
  for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
    _$jscoverage['a2r-osc/osc.js'][487]++;
    elem = _ref[i];
    _$jscoverage['a2r-osc/osc.js'][488]++;
    if (! elem.equal(other.elements[i])) {
      _$jscoverage['a2r-osc/osc.js'][489]++;
      return false;
    }
}
  _$jscoverage['a2r-osc/osc.js'][492]++;
  return true;
});
  _$jscoverage['a2r-osc/osc.js'][495]++;
  return Bundle;
})();
  _$jscoverage['a2r-osc/osc.js'][499]++;
  AbstractOscPacketGenerator = (function () {
  _$jscoverage['a2r-osc/osc.js'][501]++;
  function AbstractOscPacketGenerator(messageOrBundle, dict) {
    _$jscoverage['a2r-osc/osc.js'][502]++;
    this.dict = dict;
    _$jscoverage['a2r-osc/osc.js'][503]++;
    if (messageOrBundle instanceof Bundle) {
      _$jscoverage['a2r-osc/osc.js'][504]++;
      this.bundle = messageOrBundle;
      _$jscoverage['a2r-osc/osc.js'][505]++;
      this.size = oscSizeOfBundle(this.bundle, this.dict);
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][507]++;
      this.message = messageOrBundle;
      _$jscoverage['a2r-osc/osc.js'][508]++;
      this.size = oscSizeOfMessage(this.message, this.dict);
    }
}
  _$jscoverage['a2r-osc/osc.js'][512]++;
  AbstractOscPacketGenerator.prototype.generateMessage = (function (msg) {
  _$jscoverage['a2r-osc/osc.js'][513]++;
  var addressId, i, l, value, _results;
  _$jscoverage['a2r-osc/osc.js'][514]++;
  if (this.dict && (addressId = this.dict[msg.address])) {
    _$jscoverage['a2r-osc/osc.js'][515]++;
    this.writeUInt32(788529152);
    _$jscoverage['a2r-osc/osc.js'][516]++;
    this.writeString(",i" + msg.typeTag);
    _$jscoverage['a2r-osc/osc.js'][517]++;
    this.writeInt32(toInteger(addressId));
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][519]++;
    this.writeString(msg.address);
    _$jscoverage['a2r-osc/osc.js'][520]++;
    this.writeString("," + msg.typeTag);
  }
  _$jscoverage['a2r-osc/osc.js'][522]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][523]++;
  l = msg.typeTag.length;
  _$jscoverage['a2r-osc/osc.js'][524]++;
  _results = [];
  _$jscoverage['a2r-osc/osc.js'][525]++;
  while (i < l) {
    _$jscoverage['a2r-osc/osc.js'][526]++;
    code = msg.typeTag.charAt(i);
    _$jscoverage['a2r-osc/osc.js'][527]++;
    value = msg.arguments[i++];
    _$jscoverage['a2r-osc/osc.js'][528]++;
    type = OSC_TYPES[code];
    _$jscoverage['a2r-osc/osc.js'][529]++;
    if (! type) {
      _$jscoverage['a2r-osc/osc.js'][530]++;
      throw new Error("Type `" + code + "` isn't supported");
    }
    _$jscoverage['a2r-osc/osc.js'][532]++;
    if (type.write) {
      _$jscoverage['a2r-osc/osc.js'][533]++;
      if (type.cast) {
        _$jscoverage['a2r-osc/osc.js'][534]++;
        value = type.cast(value);
      }
      _$jscoverage['a2r-osc/osc.js'][536]++;
      _results.push(type.write(this, value));
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][538]++;
      _results.push(void 0);
    }
}
  _$jscoverage['a2r-osc/osc.js'][541]++;
  return _results;
});
  _$jscoverage['a2r-osc/osc.js'][544]++;
  AbstractOscPacketGenerator.prototype.generateBundle = (function (bundle) {
  _$jscoverage['a2r-osc/osc.js'][545]++;
  var elem, tag, _i, _len, _ref;
  _$jscoverage['a2r-osc/osc.js'][546]++;
  this.writeString("#bundle");
  _$jscoverage['a2r-osc/osc.js'][547]++;
  if (bundle.timetag <= new Date()) {
    _$jscoverage['a2r-osc/osc.js'][548]++;
    tag = [0, 1];
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][550]++;
    tag = toNTP(bundle.timetag);
  }
  _$jscoverage['a2r-osc/osc.js'][552]++;
  this.writeTimetag(tag);
  _$jscoverage['a2r-osc/osc.js'][553]++;
  _ref = bundle.elements;
  _$jscoverage['a2r-osc/osc.js'][554]++;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    _$jscoverage['a2r-osc/osc.js'][555]++;
    elem = _ref[_i];
    _$jscoverage['a2r-osc/osc.js'][556]++;
    this.writeInt32(oscSizeOfMessage(elem, this.dict));
    _$jscoverage['a2r-osc/osc.js'][557]++;
    this.generateMessage(elem);
}
  _$jscoverage['a2r-osc/osc.js'][559]++;
  return null;
});
  _$jscoverage['a2r-osc/osc.js'][562]++;
  AbstractOscPacketGenerator.prototype.writeTimetag = (function (tag) {
  _$jscoverage['a2r-osc/osc.js'][563]++;
  this.writeUInt32(tag[0]);
  _$jscoverage['a2r-osc/osc.js'][564]++;
  return this.writeUInt32(tag[1]);
});
  _$jscoverage['a2r-osc/osc.js'][567]++;
  AbstractOscPacketGenerator.prototype.generate = (function () {
  _$jscoverage['a2r-osc/osc.js'][568]++;
  if (this.bundle) {
    _$jscoverage['a2r-osc/osc.js'][569]++;
    this.generateBundle(this.bundle);
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][571]++;
    this.generateMessage(this.message);
  }
  _$jscoverage['a2r-osc/osc.js'][573]++;
  return this.buffer;
});
  _$jscoverage['a2r-osc/osc.js'][576]++;
  AbstractOscPacketGenerator.prototype.writeString = (function (string, encoding) {
  _$jscoverage['a2r-osc/osc.js'][577]++;
  if (encoding == null) {
    _$jscoverage['a2r-osc/osc.js'][578]++;
    encoding = "ascii";
  }
  _$jscoverage['a2r-osc/osc.js'][580]++;
  throw new Error("Abstract method `AbstractOscPacketGenerator::writeString` called");
});
  _$jscoverage['a2r-osc/osc.js'][583]++;
  return AbstractOscPacketGenerator;
})();
  _$jscoverage['a2r-osc/osc.js'][587]++;
  _fn = (function (name) {
  _$jscoverage['a2r-osc/osc.js'][588]++;
  name = "write" + name;
  _$jscoverage['a2r-osc/osc.js'][589]++;
  return AbstractOscPacketGenerator.prototype[name] = (function () {
  _$jscoverage['a2r-osc/osc.js'][590]++;
  throw new Error("Abstract method `AbstractOscPacketGenerator::" + name + "` called");
});
});
  _$jscoverage['a2r-osc/osc.js'][593]++;
  for (name in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][594]++;
    desc = NUMBERS[name];
    _$jscoverage['a2r-osc/osc.js'][595]++;
    _fn(name);
}
  _$jscoverage['a2r-osc/osc.js'][598]++;
  OscArrayBufferPacketGenerator = (function (_super) {
  _$jscoverage['a2r-osc/osc.js'][600]++;
  __extends(OscArrayBufferPacketGenerator, _super);
  _$jscoverage['a2r-osc/osc.js'][602]++;
  function OscArrayBufferPacketGenerator(messageOrBundle, dict) {
    _$jscoverage['a2r-osc/osc.js'][603]++;
    OscArrayBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
    _$jscoverage['a2r-osc/osc.js'][604]++;
    this.buffer = new ArrayBuffer(this.size);
    _$jscoverage['a2r-osc/osc.js'][605]++;
    this.view = new DataView(this.buffer);
    _$jscoverage['a2r-osc/osc.js'][606]++;
    this.pos = 0;
}
  _$jscoverage['a2r-osc/osc.js'][609]++;
  OscArrayBufferPacketGenerator.prototype.writeString = (function (string, encoding) {
  _$jscoverage['a2r-osc/osc.js'][610]++;
  var char, i, l, pad, _results;
  _$jscoverage['a2r-osc/osc.js'][611]++;
  if (encoding == null) {
    _$jscoverage['a2r-osc/osc.js'][612]++;
    encoding = "ascii";
  }
  _$jscoverage['a2r-osc/osc.js'][614]++;
  if (encoding !== "ascii") {
    _$jscoverage['a2r-osc/osc.js'][615]++;
    throw new Error("OscBufferWriter::writeString only supports ASCII encoding for ArrayBuffer");
  }
  _$jscoverage['a2r-osc/osc.js'][617]++;
  l = string.length;
  _$jscoverage['a2r-osc/osc.js'][618]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][619]++;
  while (i < l) {
    _$jscoverage['a2r-osc/osc.js'][620]++;
    char = string.charCodeAt(i++);
    _$jscoverage['a2r-osc/osc.js'][621]++;
    this.view.setInt8(this.pos++, char & 127);
}
  _$jscoverage['a2r-osc/osc.js'][623]++;
  pad = oscPadding(l);
  _$jscoverage['a2r-osc/osc.js'][624]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][625]++;
  _results = [];
  _$jscoverage['a2r-osc/osc.js'][626]++;
  while (i < pad) {
    _$jscoverage['a2r-osc/osc.js'][627]++;
    this.view.setInt8(this.pos++, 0);
    _$jscoverage['a2r-osc/osc.js'][628]++;
    _results.push(i++);
}
  _$jscoverage['a2r-osc/osc.js'][630]++;
  return _results;
});
  _$jscoverage['a2r-osc/osc.js'][633]++;
  OscArrayBufferPacketGenerator.prototype.writeBlob = (function (buffer) {
  _$jscoverage['a2r-osc/osc.js'][634]++;
  var array, i, l, pad;
  _$jscoverage['a2r-osc/osc.js'][635]++;
  if (nodeBuffer && Buffer.isBuffer(buffer)) {
    _$jscoverage['a2r-osc/osc.js'][636]++;
    l = buffer.length;
    _$jscoverage['a2r-osc/osc.js'][637]++;
    this.writeInt32(l);
    _$jscoverage['a2r-osc/osc.js'][638]++;
    i = 0;
    _$jscoverage['a2r-osc/osc.js'][639]++;
    while (i < l) {
      _$jscoverage['a2r-osc/osc.js'][640]++;
      this.view.setInt8(this.pos + i, buffer[i]);
      _$jscoverage['a2r-osc/osc.js'][641]++;
      i++;
}
    _$jscoverage['a2r-osc/osc.js'][643]++;
    this.pos += l;
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][645]++;
    l = buffer.byteLength;
    _$jscoverage['a2r-osc/osc.js'][646]++;
    array = new Int8Array(buffer);
    _$jscoverage['a2r-osc/osc.js'][647]++;
    this.writeInt32(l);
    _$jscoverage['a2r-osc/osc.js'][648]++;
    i = 0;
    _$jscoverage['a2r-osc/osc.js'][649]++;
    while (i < l) {
      _$jscoverage['a2r-osc/osc.js'][650]++;
      this.view.setInt8(this.pos + i, array[i]);
      _$jscoverage['a2r-osc/osc.js'][651]++;
      i++;
}
    _$jscoverage['a2r-osc/osc.js'][653]++;
    this.pos += l;
  }
  _$jscoverage['a2r-osc/osc.js'][655]++;
  pad = oscPadding(4 + l);
  _$jscoverage['a2r-osc/osc.js'][656]++;
  if (pad && pad < 4) {
    _$jscoverage['a2r-osc/osc.js'][657]++;
    i = 0;
    _$jscoverage['a2r-osc/osc.js'][658]++;
    while (i < pad) {
      _$jscoverage['a2r-osc/osc.js'][659]++;
      this.view.setInt8(this.pos + i, 0);
      _$jscoverage['a2r-osc/osc.js'][660]++;
      i++;
}
    _$jscoverage['a2r-osc/osc.js'][662]++;
    return this.pos += pad;
  }
});
  _$jscoverage['a2r-osc/osc.js'][666]++;
  return OscArrayBufferPacketGenerator;
})(AbstractOscPacketGenerator);
  _$jscoverage['a2r-osc/osc.js'][670]++;
  _fn1 = (function (type, desc) {
  _$jscoverage['a2r-osc/osc.js'][671]++;
  return OscArrayBufferPacketGenerator.prototype["write" + type] = (function (value) {
  _$jscoverage['a2r-osc/osc.js'][672]++;
  value = this.view[desc.dataViewWriter](this.pos, value, false);
  _$jscoverage['a2r-osc/osc.js'][673]++;
  this.pos += desc.size;
  _$jscoverage['a2r-osc/osc.js'][674]++;
  return value;
});
});
  _$jscoverage['a2r-osc/osc.js'][677]++;
  for (type in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][678]++;
    desc = NUMBERS[type];
    _$jscoverage['a2r-osc/osc.js'][679]++;
    _fn1(type, desc);
}
  _$jscoverage['a2r-osc/osc.js'][682]++;
  OscBufferPacketGenerator = (function (_super) {
  _$jscoverage['a2r-osc/osc.js'][684]++;
  __extends(OscBufferPacketGenerator, _super);
  _$jscoverage['a2r-osc/osc.js'][686]++;
  function OscBufferPacketGenerator(messageOrBundle, dict) {
    _$jscoverage['a2r-osc/osc.js'][687]++;
    OscBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
    _$jscoverage['a2r-osc/osc.js'][688]++;
    this.buffer = new Buffer(this.size);
    _$jscoverage['a2r-osc/osc.js'][689]++;
    this.pos = 0;
}
  _$jscoverage['a2r-osc/osc.js'][692]++;
  OscBufferPacketGenerator.prototype.writeString = (function (string, encoding) {
  _$jscoverage['a2r-osc/osc.js'][693]++;
  var length, pad;
  _$jscoverage['a2r-osc/osc.js'][694]++;
  if (encoding == null) {
    _$jscoverage['a2r-osc/osc.js'][695]++;
    encoding = "ascii";
  }
  _$jscoverage['a2r-osc/osc.js'][697]++;
  length = Buffer.byteLength(string, encoding);
  _$jscoverage['a2r-osc/osc.js'][698]++;
  this.buffer.write(string, this.pos, length, encoding);
  _$jscoverage['a2r-osc/osc.js'][699]++;
  this.pos += length;
  _$jscoverage['a2r-osc/osc.js'][700]++;
  pad = oscPadding(length);
  _$jscoverage['a2r-osc/osc.js'][701]++;
  this.buffer.fill(0, this.pos, this.pos + pad);
  _$jscoverage['a2r-osc/osc.js'][702]++;
  return this.pos += pad;
});
  _$jscoverage['a2r-osc/osc.js'][705]++;
  OscBufferPacketGenerator.prototype.writeBlob = (function (buffer) {
  _$jscoverage['a2r-osc/osc.js'][706]++;
  var array, i, length, pad;
  _$jscoverage['a2r-osc/osc.js'][707]++;
  if (buffer instanceof ArrayBuffer) {
    _$jscoverage['a2r-osc/osc.js'][708]++;
    length = buffer.byteLength;
    _$jscoverage['a2r-osc/osc.js'][709]++;
    this.writeInt32(length);
    _$jscoverage['a2r-osc/osc.js'][710]++;
    array = new Int8Array(buffer);
    _$jscoverage['a2r-osc/osc.js'][711]++;
    i = 0;
    _$jscoverage['a2r-osc/osc.js'][712]++;
    while (i < length) {
      _$jscoverage['a2r-osc/osc.js'][713]++;
      this.buffer[this.pos + i] = array[i];
      _$jscoverage['a2r-osc/osc.js'][714]++;
      i++;
}
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][717]++;
    length = buffer.length;
    _$jscoverage['a2r-osc/osc.js'][718]++;
    this.writeInt32(length);
    _$jscoverage['a2r-osc/osc.js'][719]++;
    buffer.copy(this.buffer, this.pos);
  }
  _$jscoverage['a2r-osc/osc.js'][721]++;
  pad = oscPadding(4 + length);
  _$jscoverage['a2r-osc/osc.js'][722]++;
  this.pos += length;
  _$jscoverage['a2r-osc/osc.js'][723]++;
  if (pad && pad < 4) {
    _$jscoverage['a2r-osc/osc.js'][724]++;
    this.buffer.fill(0, this.pos, this.pos + pad);
    _$jscoverage['a2r-osc/osc.js'][725]++;
    return this.pos += pad;
  }
});
  _$jscoverage['a2r-osc/osc.js'][729]++;
  return OscBufferPacketGenerator;
})(AbstractOscPacketGenerator);
  _$jscoverage['a2r-osc/osc.js'][733]++;
  _fn2 = (function (type, desc) {
  _$jscoverage['a2r-osc/osc.js'][734]++;
  return OscBufferPacketGenerator.prototype["write" + type] = (function (value) {
  _$jscoverage['a2r-osc/osc.js'][735]++;
  value = this.buffer[desc.bufferWriter](value, this.pos);
  _$jscoverage['a2r-osc/osc.js'][736]++;
  this.pos += desc.size;
  _$jscoverage['a2r-osc/osc.js'][737]++;
  return value;
});
});
  _$jscoverage['a2r-osc/osc.js'][740]++;
  for (type in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][741]++;
    desc = NUMBERS[type];
    _$jscoverage['a2r-osc/osc.js'][742]++;
    _fn2(type, desc);
}
  _$jscoverage['a2r-osc/osc.js'][745]++;
  AbstractOscPacketParser = (function () {
  _$jscoverage['a2r-osc/osc.js'][747]++;
  function AbstractOscPacketParser(buffer, pos, dict) {
    _$jscoverage['a2r-osc/osc.js'][748]++;
    if (pos == null) {
      _$jscoverage['a2r-osc/osc.js'][749]++;
      pos = 0;
    }
    _$jscoverage['a2r-osc/osc.js'][751]++;
    this.buffer = buffer;
    _$jscoverage['a2r-osc/osc.js'][752]++;
    if (typeof pos === "object") {
      _$jscoverage['a2r-osc/osc.js'][753]++;
      this.dict = pos;
      _$jscoverage['a2r-osc/osc.js'][754]++;
      this.pos = 0;
    }
    else {
      _$jscoverage['a2r-osc/osc.js'][756]++;
      this.dict = dict;
      _$jscoverage['a2r-osc/osc.js'][757]++;
      this.pos = pos;
    }
}
  _$jscoverage['a2r-osc/osc.js'][761]++;
  AbstractOscPacketParser.prototype.parse = (function () {
  _$jscoverage['a2r-osc/osc.js'][762]++;
  var address;
  _$jscoverage['a2r-osc/osc.js'][763]++;
  address = this.readString();
  _$jscoverage['a2r-osc/osc.js'][764]++;
  if (address === "#bundle") {
    _$jscoverage['a2r-osc/osc.js'][765]++;
    return this._parseBundle();
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][767]++;
    return this._parseMessage(address);
  }
});
  _$jscoverage['a2r-osc/osc.js'][771]++;
  AbstractOscPacketParser.prototype._parseMessage = (function (address) {
  _$jscoverage['a2r-osc/osc.js'][772]++;
  var addressId, args, typeTag;
  _$jscoverage['a2r-osc/osc.js'][773]++;
  if (address.charAt(0) !== "/") {
    _$jscoverage['a2r-osc/osc.js'][774]++;
    throw new Error("A address must start with a '/'");
  }
  _$jscoverage['a2r-osc/osc.js'][776]++;
  if (this.dict && (address === "/" || address === "/?")) {
    _$jscoverage['a2r-osc/osc.js'][777]++;
    typeTag = this.readTypeTag();
    _$jscoverage['a2r-osc/osc.js'][778]++;
    args = this.parseArguments(typeTag);
    _$jscoverage['a2r-osc/osc.js'][779]++;
    if (typeTag.charAt(0) !== "i") {
      _$jscoverage['a2r-osc/osc.js'][780]++;
      throw new Error("Messages with compressed addresses must have an integer as first arguments type");
    }
    _$jscoverage['a2r-osc/osc.js'][782]++;
    typeTag = typeTag.slice(1, 1);
    _$jscoverage['a2r-osc/osc.js'][783]++;
    addressId = args.shift();
    _$jscoverage['a2r-osc/osc.js'][784]++;
    address = this.dict[addressId];
    _$jscoverage['a2r-osc/osc.js'][785]++;
    if (! address) {
      _$jscoverage['a2r-osc/osc.js'][786]++;
      throw new Error("No address with id `" + addressId + "` found");
    }
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][789]++;
    typeTag = this.readTypeTag();
    _$jscoverage['a2r-osc/osc.js'][790]++;
    args = this.parseArguments(typeTag);
  }
  _$jscoverage['a2r-osc/osc.js'][792]++;
  return new Message(address, typeTag, args);
});
  _$jscoverage['a2r-osc/osc.js'][795]++;
  AbstractOscPacketParser.prototype._parseBundle = (function () {
  _$jscoverage['a2r-osc/osc.js'][796]++;
  var boundary, elements, size, timetag;
  _$jscoverage['a2r-osc/osc.js'][797]++;
  timetag = this.readTimetag();
  _$jscoverage['a2r-osc/osc.js'][798]++;
  elements = [];
  _$jscoverage['a2r-osc/osc.js'][799]++;
  while (! this.isEnd()) {
    _$jscoverage['a2r-osc/osc.js'][800]++;
    size = this.readInt32();
    _$jscoverage['a2r-osc/osc.js'][801]++;
    boundary = this.pos + size;
    _$jscoverage['a2r-osc/osc.js'][802]++;
    elements.push(this.parse());
}
  _$jscoverage['a2r-osc/osc.js'][804]++;
  return new Bundle(timetag, elements);
});
  _$jscoverage['a2r-osc/osc.js'][807]++;
  AbstractOscPacketParser.prototype.parseArguments = (function (tag, boundary) {
  _$jscoverage['a2r-osc/osc.js'][808]++;
  var i, values;
  _$jscoverage['a2r-osc/osc.js'][809]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][810]++;
  values = [];
  _$jscoverage['a2r-osc/osc.js'][811]++;
  while (i < tag.length) {
    _$jscoverage['a2r-osc/osc.js'][812]++;
    if (boundary && this.pos >= boundary) {
      _$jscoverage['a2r-osc/osc.js'][813]++;
      throw new Error("Message boundary reached");
    }
    _$jscoverage['a2r-osc/osc.js'][815]++;
    code = tag.charAt(i++);
    _$jscoverage['a2r-osc/osc.js'][816]++;
    type = OSC_TYPES[code];
    _$jscoverage['a2r-osc/osc.js'][817]++;
    if (! type) {
      _$jscoverage['a2r-osc/osc.js'][818]++;
      throw new Error("Type `" + code + "` isn't supported");
    }
    _$jscoverage['a2r-osc/osc.js'][820]++;
    values.push(type.read(this));
}
  _$jscoverage['a2r-osc/osc.js'][822]++;
  return values;
});
  _$jscoverage['a2r-osc/osc.js'][825]++;
  AbstractOscPacketParser.prototype.readTypeTag = (function () {
  _$jscoverage['a2r-osc/osc.js'][826]++;
  var tag;
  _$jscoverage['a2r-osc/osc.js'][827]++;
  tag = this.readString();
  _$jscoverage['a2r-osc/osc.js'][828]++;
  if (tag.charAt(0) === ",") {
    _$jscoverage['a2r-osc/osc.js'][829]++;
    tag = tag.slice(1);
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][831]++;
    throw new Error("A type tag must start with a ','");
  }
  _$jscoverage['a2r-osc/osc.js'][833]++;
  return tag;
});
  _$jscoverage['a2r-osc/osc.js'][836]++;
  AbstractOscPacketParser.prototype.readTimetag = (function () {
  _$jscoverage['a2r-osc/osc.js'][837]++;
  return fromNTP(this.readUInt32(), this.readUInt32());
});
  _$jscoverage['a2r-osc/osc.js'][840]++;
  AbstractOscPacketParser.prototype.readString = (function (encoding, move) {
  _$jscoverage['a2r-osc/osc.js'][841]++;
  throw new Error("Abstract method `AbstractOscPacketParser::writeString` called");
});
  _$jscoverage['a2r-osc/osc.js'][844]++;
  AbstractOscPacketParser.prototype.isEnd = (function () {
  _$jscoverage['a2r-osc/osc.js'][845]++;
  throw new Error("Abstract method `AbstractOscPacketParser::isEnd` called");
});
  _$jscoverage['a2r-osc/osc.js'][848]++;
  return AbstractOscPacketParser;
})();
  _$jscoverage['a2r-osc/osc.js'][852]++;
  _fn3 = (function (name) {
  _$jscoverage['a2r-osc/osc.js'][853]++;
  name = "read" + name;
  _$jscoverage['a2r-osc/osc.js'][854]++;
  return AbstractOscPacketParser.prototype[name] = (function () {
  _$jscoverage['a2r-osc/osc.js'][855]++;
  throw new Error("Abstract method `AbstractOscPacketParser::" + name + "` called");
});
});
  _$jscoverage['a2r-osc/osc.js'][858]++;
  for (name in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][859]++;
    desc = NUMBERS[name];
    _$jscoverage['a2r-osc/osc.js'][860]++;
    _fn3(name);
}
  _$jscoverage['a2r-osc/osc.js'][863]++;
  OscArrayBufferPacketParser = (function (_super) {
  _$jscoverage['a2r-osc/osc.js'][865]++;
  __extends(OscArrayBufferPacketParser, _super);
  _$jscoverage['a2r-osc/osc.js'][867]++;
  function OscArrayBufferPacketParser(buffer, pos, dict) {
    _$jscoverage['a2r-osc/osc.js'][868]++;
    OscArrayBufferPacketParser.__super__.constructor.apply(this, arguments);
    _$jscoverage['a2r-osc/osc.js'][869]++;
    this.view = new DataView(this.buffer);
}
  _$jscoverage['a2r-osc/osc.js'][872]++;
  OscArrayBufferPacketParser.prototype.isEnd = (function () {
  _$jscoverage['a2r-osc/osc.js'][873]++;
  return this.buffer.byteLength === 0 || this.pos === this.buffer.byteLength;
});
  _$jscoverage['a2r-osc/osc.js'][876]++;
  OscArrayBufferPacketParser.prototype.toString = (function (encoding, start, end) {
  _$jscoverage['a2r-osc/osc.js'][877]++;
  var charCode, str;
  _$jscoverage['a2r-osc/osc.js'][878]++;
  start = start != null? start: 0;
  _$jscoverage['a2r-osc/osc.js'][879]++;
  end = end != null? end: this.buffer.byteLength;
  _$jscoverage['a2r-osc/osc.js'][880]++;
  str = "";
  _$jscoverage['a2r-osc/osc.js'][881]++;
  while (start < end) {
    _$jscoverage['a2r-osc/osc.js'][882]++;
    charCode = this.view.getInt8(start++);
    _$jscoverage['a2r-osc/osc.js'][883]++;
    str += String.fromCharCode(charCode & 127);
}
  _$jscoverage['a2r-osc/osc.js'][885]++;
  return str;
});
  _$jscoverage['a2r-osc/osc.js'][888]++;
  OscArrayBufferPacketParser.prototype.readBlob = (function (move) {
  _$jscoverage['a2r-osc/osc.js'][889]++;
  var array, i, pad, size;
  _$jscoverage['a2r-osc/osc.js'][890]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][891]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][893]++;
  size = this.readInt32();
  _$jscoverage['a2r-osc/osc.js'][894]++;
  i = 0;
  _$jscoverage['a2r-osc/osc.js'][895]++;
  array = new Int8Array(new ArrayBuffer(size));
  _$jscoverage['a2r-osc/osc.js'][896]++;
  while (i < size) {
    _$jscoverage['a2r-osc/osc.js'][897]++;
    array[i] = this.view.getInt8(this.pos + i);
    _$jscoverage['a2r-osc/osc.js'][898]++;
    i++;
}
  _$jscoverage['a2r-osc/osc.js'][900]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][901]++;
    pad = oscPadding(4 + size);
    _$jscoverage['a2r-osc/osc.js'][902]++;
    if (pad < 4) {
      _$jscoverage['a2r-osc/osc.js'][903]++;
      size += pad;
    }
    _$jscoverage['a2r-osc/osc.js'][905]++;
    this.pos += size;
  }
  _$jscoverage['a2r-osc/osc.js'][907]++;
  return array.buffer;
});
  _$jscoverage['a2r-osc/osc.js'][910]++;
  OscArrayBufferPacketParser.prototype.readString = (function (encoding, move) {
  _$jscoverage['a2r-osc/osc.js'][911]++;
  var length, nullSeen, pos, string, stringLength;
  _$jscoverage['a2r-osc/osc.js'][912]++;
  if (encoding == null) {
    _$jscoverage['a2r-osc/osc.js'][913]++;
    encoding = "ascii";
  }
  _$jscoverage['a2r-osc/osc.js'][915]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][916]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][918]++;
  if (this.isEnd()) {
    _$jscoverage['a2r-osc/osc.js'][919]++;
    throw new Error("No data left");
  }
  _$jscoverage['a2r-osc/osc.js'][921]++;
  length = 4;
  _$jscoverage['a2r-osc/osc.js'][922]++;
  nullSeen = false;
  _$jscoverage['a2r-osc/osc.js'][923]++;
  while ((pos = this.pos + length - 1) < this.buffer.byteLength) {
    _$jscoverage['a2r-osc/osc.js'][924]++;
    if (this.view.getInt8(pos) === 0) {
      _$jscoverage['a2r-osc/osc.js'][925]++;
      nullSeen = true;
      _$jscoverage['a2r-osc/osc.js'][926]++;
      break;
    }
    _$jscoverage['a2r-osc/osc.js'][928]++;
    length += 4;
}
  _$jscoverage['a2r-osc/osc.js'][930]++;
  if (length === 0 || nullSeen === false) {
    _$jscoverage['a2r-osc/osc.js'][931]++;
    throw new Error("No string data found");
  }
  _$jscoverage['a2r-osc/osc.js'][933]++;
  stringLength = length - 4;
  _$jscoverage['a2r-osc/osc.js'][934]++;
  while (stringLength < length) {
    _$jscoverage['a2r-osc/osc.js'][935]++;
    if (this.view.getInt8(this.pos + stringLength) === 0) {
      _$jscoverage['a2r-osc/osc.js'][936]++;
      break;
    }
    _$jscoverage['a2r-osc/osc.js'][938]++;
    stringLength++;
}
  _$jscoverage['a2r-osc/osc.js'][940]++;
  string = this.toString(encoding, this.pos, this.pos + stringLength);
  _$jscoverage['a2r-osc/osc.js'][941]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][942]++;
    this.pos += length;
  }
  _$jscoverage['a2r-osc/osc.js'][944]++;
  return string;
});
  _$jscoverage['a2r-osc/osc.js'][947]++;
  return OscArrayBufferPacketParser;
})(AbstractOscPacketParser);
  _$jscoverage['a2r-osc/osc.js'][951]++;
  _fn4 = (function (type, desc) {
  _$jscoverage['a2r-osc/osc.js'][952]++;
  return OscArrayBufferPacketParser.prototype["read" + type] = (function (move) {
  _$jscoverage['a2r-osc/osc.js'][953]++;
  var value;
  _$jscoverage['a2r-osc/osc.js'][954]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][955]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][957]++;
  value = this.view[desc.dataViewReader](this.pos, false);
  _$jscoverage['a2r-osc/osc.js'][958]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][959]++;
    this.pos += desc.size;
  }
  _$jscoverage['a2r-osc/osc.js'][961]++;
  return value;
});
});
  _$jscoverage['a2r-osc/osc.js'][964]++;
  for (type in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][965]++;
    desc = NUMBERS[type];
    _$jscoverage['a2r-osc/osc.js'][966]++;
    _fn4(type, desc);
}
  _$jscoverage['a2r-osc/osc.js'][969]++;
  OscBufferPacketParser = (function (_super) {
  _$jscoverage['a2r-osc/osc.js'][971]++;
  __extends(OscBufferPacketParser, _super);
  _$jscoverage['a2r-osc/osc.js'][973]++;
  function OscBufferPacketParser(buffer, pos, dict) {
    _$jscoverage['a2r-osc/osc.js'][974]++;
    OscBufferPacketParser.__super__.constructor.apply(this, arguments);
}
  _$jscoverage['a2r-osc/osc.js'][977]++;
  OscBufferPacketParser.prototype.isEnd = (function () {
  _$jscoverage['a2r-osc/osc.js'][978]++;
  return this.buffer.length === 0 || this.pos === this.buffer.length;
});
  _$jscoverage['a2r-osc/osc.js'][981]++;
  OscBufferPacketParser.prototype.toString = (function () {
  _$jscoverage['a2r-osc/osc.js'][982]++;
  return this.buffer.toString.apply(this.buffer, arguments);
});
  _$jscoverage['a2r-osc/osc.js'][985]++;
  OscBufferPacketParser.prototype.readBlob = (function (move) {
  _$jscoverage['a2r-osc/osc.js'][986]++;
  var buf, pad, size;
  _$jscoverage['a2r-osc/osc.js'][987]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][988]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][990]++;
  size = this.readInt32();
  _$jscoverage['a2r-osc/osc.js'][991]++;
  buf = new Buffer(size);
  _$jscoverage['a2r-osc/osc.js'][992]++;
  this.buffer.copy(buf, 0, this.pos, this.pos + size);
  _$jscoverage['a2r-osc/osc.js'][993]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][994]++;
    pad = oscPadding(4 + size);
    _$jscoverage['a2r-osc/osc.js'][995]++;
    if (pad < 4) {
      _$jscoverage['a2r-osc/osc.js'][996]++;
      size += pad;
    }
    _$jscoverage['a2r-osc/osc.js'][998]++;
    this.pos += size;
  }
  _$jscoverage['a2r-osc/osc.js'][1000]++;
  return buf;
});
  _$jscoverage['a2r-osc/osc.js'][1003]++;
  OscBufferPacketParser.prototype.readString = (function (encoding, move) {
  _$jscoverage['a2r-osc/osc.js'][1004]++;
  var length, nullSeen, pos, string, stringLength;
  _$jscoverage['a2r-osc/osc.js'][1005]++;
  if (encoding == null) {
    _$jscoverage['a2r-osc/osc.js'][1006]++;
    encoding = "ascii";
  }
  _$jscoverage['a2r-osc/osc.js'][1008]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][1009]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][1011]++;
  if (this.isEnd()) {
    _$jscoverage['a2r-osc/osc.js'][1012]++;
    throw new Error("No data left");
  }
  _$jscoverage['a2r-osc/osc.js'][1014]++;
  length = 4;
  _$jscoverage['a2r-osc/osc.js'][1015]++;
  nullSeen = false;
  _$jscoverage['a2r-osc/osc.js'][1016]++;
  while ((pos = this.pos + length - 1) < this.buffer.length) {
    _$jscoverage['a2r-osc/osc.js'][1017]++;
    if (this.buffer[pos] === 0) {
      _$jscoverage['a2r-osc/osc.js'][1018]++;
      nullSeen = true;
      _$jscoverage['a2r-osc/osc.js'][1019]++;
      break;
    }
    _$jscoverage['a2r-osc/osc.js'][1021]++;
    length += 4;
}
  _$jscoverage['a2r-osc/osc.js'][1023]++;
  if (length === 0 || nullSeen === false) {
    _$jscoverage['a2r-osc/osc.js'][1024]++;
    throw new Error("No string data found");
  }
  _$jscoverage['a2r-osc/osc.js'][1026]++;
  stringLength = length - 4;
  _$jscoverage['a2r-osc/osc.js'][1027]++;
  while (stringLength < length) {
    _$jscoverage['a2r-osc/osc.js'][1028]++;
    if (this.buffer[this.pos + stringLength] === 0) {
      _$jscoverage['a2r-osc/osc.js'][1029]++;
      break;
    }
    _$jscoverage['a2r-osc/osc.js'][1031]++;
    stringLength++;
}
  _$jscoverage['a2r-osc/osc.js'][1033]++;
  string = this.toString(encoding, this.pos, this.pos + stringLength);
  _$jscoverage['a2r-osc/osc.js'][1034]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][1035]++;
    this.pos += length;
  }
  _$jscoverage['a2r-osc/osc.js'][1037]++;
  return string;
});
  _$jscoverage['a2r-osc/osc.js'][1040]++;
  return OscBufferPacketParser;
})(AbstractOscPacketParser);
  _$jscoverage['a2r-osc/osc.js'][1044]++;
  _fn5 = (function (type, desc) {
  _$jscoverage['a2r-osc/osc.js'][1045]++;
  return OscBufferPacketParser.prototype["read" + type] = (function (move) {
  _$jscoverage['a2r-osc/osc.js'][1046]++;
  var value;
  _$jscoverage['a2r-osc/osc.js'][1047]++;
  if (move == null) {
    _$jscoverage['a2r-osc/osc.js'][1048]++;
    move = true;
  }
  _$jscoverage['a2r-osc/osc.js'][1050]++;
  value = this.buffer[desc.bufferReader](this.pos);
  _$jscoverage['a2r-osc/osc.js'][1051]++;
  if (move) {
    _$jscoverage['a2r-osc/osc.js'][1052]++;
    this.pos += desc.size;
  }
  _$jscoverage['a2r-osc/osc.js'][1054]++;
  return value;
});
});
  _$jscoverage['a2r-osc/osc.js'][1057]++;
  for (type in NUMBERS) {
    _$jscoverage['a2r-osc/osc.js'][1058]++;
    desc = NUMBERS[type];
    _$jscoverage['a2r-osc/osc.js'][1059]++;
    _fn5(type, desc);
}
  _$jscoverage['a2r-osc/osc.js'][1062]++;
  fromBuffer = (function (buffer, pos, dict) {
  _$jscoverage['a2r-osc/osc.js'][1063]++;
  if (nodeBuffer && Buffer.isBuffer(buffer)) {
    _$jscoverage['a2r-osc/osc.js'][1064]++;
    return new OscBufferPacketParser(buffer, pos, dict).parse();
  }
  else {
    _$jscoverage['a2r-osc/osc.js'][1066]++;
    return new OscArrayBufferPacketParser(buffer, pos, dict).parse();
  }
});
  _$jscoverage['a2r-osc/osc.js'][1070]++;
  exports = module.exports;
  _$jscoverage['a2r-osc/osc.js'][1072]++;
  exports.NUMBERS = NUMBERS;
  _$jscoverage['a2r-osc/osc.js'][1074]++;
  exports.toNTP = toNTP;
  _$jscoverage['a2r-osc/osc.js'][1076]++;
  exports.Message = Message;
  _$jscoverage['a2r-osc/osc.js'][1078]++;
  exports.Bundle = Bundle;
  _$jscoverage['a2r-osc/osc.js'][1080]++;
  exports.Impulse = Impulse;
  _$jscoverage['a2r-osc/osc.js'][1082]++;
  exports.AbstractOscPacketGenerator = AbstractOscPacketGenerator;
  _$jscoverage['a2r-osc/osc.js'][1084]++;
  exports.AbstractOscPacketParser = AbstractOscPacketParser;
  _$jscoverage['a2r-osc/osc.js'][1086]++;
  exports.OscBufferPacketGenerator = OscBufferPacketGenerator;
  _$jscoverage['a2r-osc/osc.js'][1088]++;
  exports.OscBufferPacketParser = OscBufferPacketParser;
  _$jscoverage['a2r-osc/osc.js'][1090]++;
  exports.OscArrayBufferPacketGenerator = OscArrayBufferPacketGenerator;
  _$jscoverage['a2r-osc/osc.js'][1092]++;
  exports.OscArrayBufferPacketParser = OscArrayBufferPacketParser;
  _$jscoverage['a2r-osc/osc.js'][1094]++;
  exports.fromBuffer = fromBuffer;
}).call(this);
_$jscoverage['a2r-osc/osc.js'].source = ["// Generated by CoffeeScript 1.4.0","(function() {","  var AbstractOscPacketGenerator, AbstractOscPacketParser, Bundle, Impulse, Message, NUMBERS, OSC_TYPES, OSC_TYPES_BY_NAME, OscArrayBufferPacketGenerator, OscArrayBufferPacketParser, OscBufferPacketGenerator, OscBufferPacketParser, SECONDS_FROM_1900_to_1970, code, desc, exports, fromBuffer, fromNTP, name, nodeBuffer, oscPadding, oscSizeOf, oscSizeOfBlob, oscSizeOfBundle, oscSizeOfMessage, oscSizeOfString, oscTypeCodeOf, toInteger, toNTP, toNumber, type, _fn, _fn1, _fn2, _fn3, _fn4, _fn5,","    __hasProp = {}.hasOwnProperty,","    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };","","  nodeBuffer = typeof Buffer === 'function';","","  toNumber = function(val) {","    val = Number(val);","    if (val === NaN) {","      throw new Error(\"Value isn't a number\");","    }","    return val;","  };","","  toInteger = function(val) {","    val = toNumber(val);","    return Math.round(val);","  };","","  SECONDS_FROM_1900_to_1970 = 2208988800;","","  fromNTP = function(seconds, fraction) {","    var date, ms;","    if (seconds === 0 &amp;&amp; fraction === 1) {","      return new Date;","    }","    ms = (seconds - SECONDS_FROM_1900_to_1970) * 1000;","    ms += Math.round(1000 * fraction / 0x100000000);","    date = new Date(ms);","    date.ntpSeconds = seconds;","    date.ntpFraction = fraction;","    return date;","  };","","  toNTP = function(date) {","    var fraction, seconds, time;","    if (date === 1) {","      return [0, 1];","    }","    if (Array.isArray(date)) {","      return date;","    }","    time = date.getTime();","    seconds = Math.floor(time / 1000);","    fraction = Math.round(((time % 1000) * 0x100000000) / 1000);","    return [seconds + SECONDS_FROM_1900_to_1970, fraction];","  };","","  OSC_TYPES = {","    i: {","      name: \"integer\",","      read: function(reader) {","        return reader.readInt32();","      },","      write: function(writer, value) {","        return writer.writeInt32(value);","      },","      cast: toInteger,","      sizeOf: function(value) {","        return 4;","      }","    },","    f: {","      name: \"float\",","      read: function(reader) {","        return reader.readFloat();","      },","      write: function(writer, value) {","        return writer.writeFloat(value);","      },","      cast: toNumber,","      sizeOf: function(value) {","        return 4;","      }","    },","    s: {","      name: \"string\",","      read: function(reader) {","        return reader.readString();","      },","      write: function(writer, value) {","        return writer.writeString(value);","      },","      cast: function(value) {","        return value.toString();","      },","      sizeOf: function(value) {","        return oscSizeOfString(value.toString());","      }","    },","    b: {","      name: \"blob\",","      read: function(reader) {","        return reader.readBlob();","      },","      write: function(writer, value) {","        return writer.writeBlob(value);","      },","      sizeOf: function(value) {","        return oscSizeOfBlob(value);","      }","    },","    d: {","      name: \"double\",","      read: function(reader) {","        return reader.readDouble();","      },","      write: function(writer, value) {","        return writer.writeDouble(value);","      },","      sizeOf: function(value) {","        return 8;","      }","    },","    c: {","      name: \"char\",","      read: function(reader) {","        return String.fromCharCode(reader.readInt32() &amp; 0x7F);","      },","      write: function(writer, value) {","        return writer.writeInt32(value.charCodeAt(0));","      },","      cast: function(value) {","        return value.toString().charAt(0);","      },","      sizeOf: function(value) {","        return 4;","      }","    },","    r: {","      name: \"color\",","      read: function(reader) {","        return reader.readInt32();","      },","      write: function(writer, value) {","        return writer.writeInt32(value);","      },","      cast: toInteger,","      sizeOf: function(value) {","        return 4;","      }","    },","    t: {","      name: \"time\",","      read: function(reader) {","        return reader.readTimetag();","      },","      write: function(writer, value) {","        return writer.writeTimetag(value);","      },","      cast: toNTP,","      sizeOf: function() {","        return 8;","      }","    },","    T: {","      name: \"true\",","      read: function() {","        return true;","      }","    },","    F: {","      name: \"false\",","      read: function() {","        return false;","      }","    },","    N: {","      name: \"null\",","      read: function() {","        return null;","      }","    },","    I: {","      name: \"impulse\",","      read: function() {","        return Impulse;","      }","    }","  };","","  OSC_TYPES.S = OSC_TYPES.s;","","  OSC_TYPES_BY_NAME = {};","","  for (code in OSC_TYPES) {","    type = OSC_TYPES[code];","    if (code !== 'S') {","      type.code = code;","    }","    OSC_TYPES_BY_NAME[type.name] = type;","  }","","  NUMBERS = {","    Int32: {","      dataViewReader: \"getInt32\",","      dataViewWriter: \"setInt32\",","      bufferReader: \"readInt32BE\",","      bufferWriter: \"writeInt32BE\",","      size: 4","    },","    UInt32: {","      dataViewReader: \"getUint32\",","      dataViewWriter: \"setUint32\",","      bufferReader: \"readUInt32BE\",","      bufferWriter: \"writeUInt32BE\",","      size: 4","    },","    Float: {","      dataViewReader: \"getFloat32\",","      dataViewWriter: \"setFloat32\",","      bufferReader: \"readFloatBE\",","      bufferWriter: \"writeFloatBE\",","      size: 4","    },","    Double: {","      dataViewReader: \"getFloat64\",","      dataViewWriter: \"setFloat64\",","      bufferReader: \"readDoubleBE\",","      bufferWriter: \"writeDoubleBE\",","      size: 8","    }","  };","","  oscPadding = function(len) {","    return 4 - len % 4;","  };","","  Impulse = new Object;","","  oscTypeCodeOf = function(val) {","    switch (typeof val) {","      case 'string':","        return 's';","      case 'number':","        return 'f';","      case 'boolean':","        if (val) {","          return 'T';","        } else {","          return 'F';","        }","        break;","      case 'undefined':","        throw new Error(\"Value can't be undefined\");","        break;","      case 'object':","        if (val === null) {","          return 'N';","        } else if (val instanceof Date) {","          return 't';","        } else if ((nodeBuffer &amp;&amp; Buffer.isBuffer(val)) || val instanceof ArrayBuffer) {","          return 'b';","        } else if (val === Impulse) {","          return 'I';","        } else {","          throw new Error(\"Unsupported type `\" + val + \"`\");","        }","        break;","      default:","        throw new Error(\"Unsupported type `\" + val + \"`\");","    }","  };","","  oscSizeOfString = function(str) {","    return str.length + oscPadding(str.length);","  };","","  oscSizeOfBlob = function(buf) {","    var length, pad;","    if (buf instanceof ArrayBuffer) {","      length = 4 + buf.byteLength;","    } else {","      length = 4 + buf.length;","    }","    pad = oscPadding(length);","    if (pad &lt; 4) {","      length += pad;","    }","    return length;","  };","","  oscSizeOfBundle = function(bundle, dict) {","    var elem, size, _i, _len, _ref;","    size = 16;","    _ref = bundle.elements;","    for (_i = 0, _len = _ref.length; _i &lt; _len; _i++) {","      elem = _ref[_i];","      size += 4 + oscSizeOfMessage(elem, dict);","    }","    return size;","  };","","  oscSizeOfMessage = function(msg, dict) {","    var addressId, i, l, size, tl, typeCode, value;","    addressId = dict != null ? dict[msg.address] : void 0;","    if (addressId) {","      size = 8;","    } else {","      size = oscSizeOfString(msg.address);","    }","    if (addressId) {","      tl = msg.typeTag.length + 2;","    } else {","      tl = msg.typeTag.length + 1;","    }","    size += tl + oscPadding(tl);","    i = 0;","    l = msg.typeTag.length;","    while (i &lt; l) {","      typeCode = msg.typeTag.charAt(i);","      value = msg[\"arguments\"][i++];","      size += oscSizeOf(value, typeCode);","    }","    return size;","  };","","  oscSizeOf = function(value, code) {","    if (code) {","      type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];","      if (!type) {","        throw new Error(\"Type `\" + code + \"` isn't supported\");","      }","      if (!type.sizeOf) {","        return 0;","      }","      return type.sizeOf(value);","    } else {","      code = oscTypeCodeOf(value);","      return oscSizeOf(value, code);","    }","  };","","  Message = (function() {","","    function Message(address, typeTag, args) {","      var value;","      this.address = address;","      if (typeTag &amp;&amp; !(args != null)) {","        args = typeTag;","        typeTag = null;","      }","      if (!Array.isArray(args)) {","        args = [args];","      }","      if (typeTag) {","        this.typeTag = typeTag;","        this[\"arguments\"] = args;","      } else {","        this.typeTag = \"\";","        this[\"arguments\"] = (function() {","          var _i, _len, _results;","          _results = [];","          for (_i = 0, _len = args.length; _i &lt; _len; _i++) {","            value = args[_i];","            if (typeof value === 'object' &amp;&amp; ((value != null ? value.type : void 0) != null)) {","              code = value.type;","              type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];","              if (!type) {","                throw new Error(\"Type `\" + code + \"` isn't supported\");","              }","              this.typeTag += type.code;","              if (type.sizeOf) {","                _results.push(value.value);","              } else {","                _results.push(type.read());","              }","            } else {","              this.typeTag += oscTypeCodeOf(value);","              _results.push(value);","            }","          }","          return _results;","        }).call(this);","      }","      if (this[\"arguments\"].length !== this.typeTag.length) {","        throw new Error(\"Arguments doesn't match typetag\");","      }","    }","","    Message.prototype.toBuffer = function(dict) {","      if (nodeBuffer) {","        return new OscBufferPacketGenerator(this, dict).generate();","      } else {","        return new OscArrayBufferPacketGenerator(this, dict).generate();","      }","    };","","    Message.prototype.equal = function(other) {","      var arg, i, _i, _len, _ref;","      if (!(other instanceof Message)) {","        return false;","      }","      if (other.address !== this.address) {","        return false;","      }","      if (other.typeTag !== this.typeTag) {","        return false;","      }","      if (other[\"arguments\"].length !== this[\"arguments\"].length) {","        return false;","      }","      _ref = this[\"arguments\"];","      for (i = _i = 0, _len = _ref.length; _i &lt; _len; i = ++_i) {","        arg = _ref[i];","        if (other[\"arguments\"][i] !== arg) {","          return false;","        }","      }","      return true;","    };","","    return Message;","","  })();","","  Bundle = (function() {","","    function Bundle(timetag, elements) {","      var elem, _i, _len, _ref;","      if (timetag instanceof Date) {","        this.timetag = timetag;","      } else if (timetag === 1) {","        this.timetag = new Date;","      } else {","        this.timetag = new Date;","        elements = timetag;","      }","      if (elements) {","        if (!Array.isArray(elements)) {","          elements = [elements];","        }","        this.elements = elements;","      } else {","        this.elements = [];","      }","      _ref = this.elements;","      for (_i = 0, _len = _ref.length; _i &lt; _len; _i++) {","        elem = _ref[_i];","        if (!elem instanceof Message) {","          throw new Error(\"A bundle element must be an instance of Message\");","        }","      }","      null;","    }","","    Bundle.prototype.addElement = function(address, typeTag, args) {","      var msg;","      if (address instanceof Message) {","        this.elements.push(address);","        return address;","      } else {","        msg = new Message(address, typeTag, args);","        this.elements.push(msg);","        return msg;","      }","    };","","    Bundle.prototype.message = function(address, typeTag, args) {","      this.addElement(address, typeTag, args);","      return this;","    };","","    Bundle.prototype.toBuffer = function(dict) {","      if (nodeBuffer) {","        return new OscBufferPacketGenerator(this, dict).generate();","      } else {","        return new OscArrayBufferPacketGenerator(this, dict).generate();","      }","    };","","    Bundle.prototype.equal = function(other) {","      var elem, i, _i, _len, _ref;","      if (!(other instanceof Bundle)) {","        return false;","      }","      if (other.timetag !== this.timetag) {","        return false;","      }","      if (other.elements.length !== this.elements.length) {","        return false;","      }","      _ref = this.elements;","      for (i = _i = 0, _len = _ref.length; _i &lt; _len; i = ++_i) {","        elem = _ref[i];","        if (!elem.equal(other.elements[i])) {","          return false;","        }","      }","      return true;","    };","","    return Bundle;","","  })();","","  AbstractOscPacketGenerator = (function() {","","    function AbstractOscPacketGenerator(messageOrBundle, dict) {","      this.dict = dict;","      if (messageOrBundle instanceof Bundle) {","        this.bundle = messageOrBundle;","        this.size = oscSizeOfBundle(this.bundle, this.dict);","      } else {","        this.message = messageOrBundle;","        this.size = oscSizeOfMessage(this.message, this.dict);","      }","    }","","    AbstractOscPacketGenerator.prototype.generateMessage = function(msg) {","      var addressId, i, l, value, _results;","      if (this.dict &amp;&amp; (addressId = this.dict[msg.address])) {","        this.writeUInt32(0x2f000000);","        this.writeString(\",i\" + msg.typeTag);","        this.writeInt32(toInteger(addressId));","      } else {","        this.writeString(msg.address);","        this.writeString(\",\" + msg.typeTag);","      }","      i = 0;","      l = msg.typeTag.length;","      _results = [];","      while (i &lt; l) {","        code = msg.typeTag.charAt(i);","        value = msg[\"arguments\"][i++];","        type = OSC_TYPES[code];","        if (!type) {","          throw new Error(\"Type `\" + code + \"` isn't supported\");","        }","        if (type.write) {","          if (type.cast) {","            value = type.cast(value);","          }","          _results.push(type.write(this, value));","        } else {","          _results.push(void 0);","        }","      }","      return _results;","    };","","    AbstractOscPacketGenerator.prototype.generateBundle = function(bundle) {","      var elem, tag, _i, _len, _ref;","      this.writeString(\"#bundle\");","      if (bundle.timetag &lt;= new Date) {","        tag = [0, 1];","      } else {","        tag = toNTP(bundle.timetag);","      }","      this.writeTimetag(tag);","      _ref = bundle.elements;","      for (_i = 0, _len = _ref.length; _i &lt; _len; _i++) {","        elem = _ref[_i];","        this.writeInt32(oscSizeOfMessage(elem, this.dict));","        this.generateMessage(elem);","      }","      return null;","    };","","    AbstractOscPacketGenerator.prototype.writeTimetag = function(tag) {","      this.writeUInt32(tag[0]);","      return this.writeUInt32(tag[1]);","    };","","    AbstractOscPacketGenerator.prototype.generate = function() {","      if (this.bundle) {","        this.generateBundle(this.bundle);","      } else {","        this.generateMessage(this.message);","      }","      return this.buffer;","    };","","    AbstractOscPacketGenerator.prototype.writeString = function(string, encoding) {","      if (encoding == null) {","        encoding = \"ascii\";","      }","      throw new Error(\"Abstract method `AbstractOscPacketGenerator::writeString` called\");","    };","","    return AbstractOscPacketGenerator;","","  })();","","  _fn = function(name) {","    name = \"write\" + name;","    return AbstractOscPacketGenerator.prototype[name] = function() {","      throw new Error(\"Abstract method `AbstractOscPacketGenerator::\" + name + \"` called\");","    };","  };","  for (name in NUMBERS) {","    desc = NUMBERS[name];","    _fn(name);","  }","","  OscArrayBufferPacketGenerator = (function(_super) {","","    __extends(OscArrayBufferPacketGenerator, _super);","","    function OscArrayBufferPacketGenerator(messageOrBundle, dict) {","      OscArrayBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);","      this.buffer = new ArrayBuffer(this.size);","      this.view = new DataView(this.buffer);","      this.pos = 0;","    }","","    OscArrayBufferPacketGenerator.prototype.writeString = function(string, encoding) {","      var char, i, l, pad, _results;","      if (encoding == null) {","        encoding = \"ascii\";","      }","      if (encoding !== \"ascii\") {","        throw new Error(\"OscBufferWriter::writeString only supports ASCII encoding for ArrayBuffer\");","      }","      l = string.length;","      i = 0;","      while (i &lt; l) {","        char = string.charCodeAt(i++);","        this.view.setInt8(this.pos++, char &amp; 0x7F);","      }","      pad = oscPadding(l);","      i = 0;","      _results = [];","      while (i &lt; pad) {","        this.view.setInt8(this.pos++, 0);","        _results.push(i++);","      }","      return _results;","    };","","    OscArrayBufferPacketGenerator.prototype.writeBlob = function(buffer) {","      var array, i, l, pad;","      if (nodeBuffer &amp;&amp; Buffer.isBuffer(buffer)) {","        l = buffer.length;","        this.writeInt32(l);","        i = 0;","        while (i &lt; l) {","          this.view.setInt8(this.pos + i, buffer[i]);","          i++;","        }","        this.pos += l;","      } else {","        l = buffer.byteLength;","        array = new Int8Array(buffer);","        this.writeInt32(l);","        i = 0;","        while (i &lt; l) {","          this.view.setInt8(this.pos + i, array[i]);","          i++;","        }","        this.pos += l;","      }","      pad = oscPadding(4 + l);","      if (pad &amp;&amp; pad &lt; 4) {","        i = 0;","        while (i &lt; pad) {","          this.view.setInt8(this.pos + i, 0);","          i++;","        }","        return this.pos += pad;","      }","    };","","    return OscArrayBufferPacketGenerator;","","  })(AbstractOscPacketGenerator);","","  _fn1 = function(type, desc) {","    return OscArrayBufferPacketGenerator.prototype[\"write\" + type] = function(value) {","      value = this.view[desc.dataViewWriter](this.pos, value, false);","      this.pos += desc.size;","      return value;","    };","  };","  for (type in NUMBERS) {","    desc = NUMBERS[type];","    _fn1(type, desc);","  }","","  OscBufferPacketGenerator = (function(_super) {","","    __extends(OscBufferPacketGenerator, _super);","","    function OscBufferPacketGenerator(messageOrBundle, dict) {","      OscBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);","      this.buffer = new Buffer(this.size);","      this.pos = 0;","    }","","    OscBufferPacketGenerator.prototype.writeString = function(string, encoding) {","      var length, pad;","      if (encoding == null) {","        encoding = \"ascii\";","      }","      length = Buffer.byteLength(string, encoding);","      this.buffer.write(string, this.pos, length, encoding);","      this.pos += length;","      pad = oscPadding(length);","      this.buffer.fill(0, this.pos, this.pos + pad);","      return this.pos += pad;","    };","","    OscBufferPacketGenerator.prototype.writeBlob = function(buffer) {","      var array, i, length, pad;","      if (buffer instanceof ArrayBuffer) {","        length = buffer.byteLength;","        this.writeInt32(length);","        array = new Int8Array(buffer);","        i = 0;","        while (i &lt; length) {","          this.buffer[this.pos + i] = array[i];","          i++;","        }","      } else {","        length = buffer.length;","        this.writeInt32(length);","        buffer.copy(this.buffer, this.pos);","      }","      pad = oscPadding(4 + length);","      this.pos += length;","      if (pad &amp;&amp; pad &lt; 4) {","        this.buffer.fill(0, this.pos, this.pos + pad);","        return this.pos += pad;","      }","    };","","    return OscBufferPacketGenerator;","","  })(AbstractOscPacketGenerator);","","  _fn2 = function(type, desc) {","    return OscBufferPacketGenerator.prototype[\"write\" + type] = function(value) {","      value = this.buffer[desc.bufferWriter](value, this.pos);","      this.pos += desc.size;","      return value;","    };","  };","  for (type in NUMBERS) {","    desc = NUMBERS[type];","    _fn2(type, desc);","  }","","  AbstractOscPacketParser = (function() {","","    function AbstractOscPacketParser(buffer, pos, dict) {","      if (pos == null) {","        pos = 0;","      }","      this.buffer = buffer;","      if (typeof pos === \"object\") {","        this.dict = pos;","        this.pos = 0;","      } else {","        this.dict = dict;","        this.pos = pos;","      }","    }","","    AbstractOscPacketParser.prototype.parse = function() {","      var address;","      address = this.readString();","      if (address === \"#bundle\") {","        return this._parseBundle();","      } else {","        return this._parseMessage(address);","      }","    };","","    AbstractOscPacketParser.prototype._parseMessage = function(address) {","      var addressId, args, typeTag;","      if (address.charAt(0) !== '/') {","        throw new Error(\"A address must start with a '/'\");","      }","      if (this.dict &amp;&amp; (address === \"/\" || address === \"/?\")) {","        typeTag = this.readTypeTag();","        args = this.parseArguments(typeTag);","        if (typeTag.charAt(0) !== 'i') {","          throw new Error(\"Messages with compressed addresses must have an integer as first arguments type\");","        }","        typeTag = typeTag.slice(1, 1);","        addressId = args.shift();","        address = this.dict[addressId];","        if (!address) {","          throw new Error(\"No address with id `\" + addressId + \"` found\");","        }","      } else {","        typeTag = this.readTypeTag();","        args = this.parseArguments(typeTag);","      }","      return new Message(address, typeTag, args);","    };","","    AbstractOscPacketParser.prototype._parseBundle = function() {","      var boundary, elements, size, timetag;","      timetag = this.readTimetag();","      elements = [];","      while (!this.isEnd()) {","        size = this.readInt32();","        boundary = this.pos + size;","        elements.push(this.parse());","      }","      return new Bundle(timetag, elements);","    };","","    AbstractOscPacketParser.prototype.parseArguments = function(tag, boundary) {","      var i, values;","      i = 0;","      values = [];","      while (i &lt; tag.length) {","        if (boundary &amp;&amp; this.pos &gt;= boundary) {","          throw new Error(\"Message boundary reached\");","        }","        code = tag.charAt(i++);","        type = OSC_TYPES[code];","        if (!type) {","          throw new Error(\"Type `\" + code + \"` isn't supported\");","        }","        values.push(type.read(this));","      }","      return values;","    };","","    AbstractOscPacketParser.prototype.readTypeTag = function() {","      var tag;","      tag = this.readString();","      if (tag.charAt(0) === ',') {","        tag = tag.slice(1);","      } else {","        throw new Error(\"A type tag must start with a ','\");","      }","      return tag;","    };","","    AbstractOscPacketParser.prototype.readTimetag = function() {","      return fromNTP(this.readUInt32(), this.readUInt32());","    };","","    AbstractOscPacketParser.prototype.readString = function(encoding, move) {","      throw new Error(\"Abstract method `AbstractOscPacketParser::writeString` called\");","    };","","    AbstractOscPacketParser.prototype.isEnd = function() {","      throw new Error(\"Abstract method `AbstractOscPacketParser::isEnd` called\");","    };","","    return AbstractOscPacketParser;","","  })();","","  _fn3 = function(name) {","    name = \"read\" + name;","    return AbstractOscPacketParser.prototype[name] = function() {","      throw new Error(\"Abstract method `AbstractOscPacketParser::\" + name + \"` called\");","    };","  };","  for (name in NUMBERS) {","    desc = NUMBERS[name];","    _fn3(name);","  }","","  OscArrayBufferPacketParser = (function(_super) {","","    __extends(OscArrayBufferPacketParser, _super);","","    function OscArrayBufferPacketParser(buffer, pos, dict) {","      OscArrayBufferPacketParser.__super__.constructor.apply(this, arguments);","      this.view = new DataView(this.buffer);","    }","","    OscArrayBufferPacketParser.prototype.isEnd = function() {","      return this.buffer.byteLength === 0 || this.pos === this.buffer.byteLength;","    };","","    OscArrayBufferPacketParser.prototype.toString = function(encoding, start, end) {","      var charCode, str;","      start = start != null ? start : 0;","      end = end != null ? end : this.buffer.byteLength;","      str = \"\";","      while (start &lt; end) {","        charCode = this.view.getInt8(start++);","        str += String.fromCharCode(charCode &amp; 0x7F);","      }","      return str;","    };","","    OscArrayBufferPacketParser.prototype.readBlob = function(move) {","      var array, i, pad, size;","      if (move == null) {","        move = true;","      }","      size = this.readInt32();","      i = 0;","      array = new Int8Array(new ArrayBuffer(size));","      while (i &lt; size) {","        array[i] = this.view.getInt8(this.pos + i);","        i++;","      }","      if (move) {","        pad = oscPadding(4 + size);","        if (pad &lt; 4) {","          size += pad;","        }","        this.pos += size;","      }","      return array.buffer;","    };","","    OscArrayBufferPacketParser.prototype.readString = function(encoding, move) {","      var length, nullSeen, pos, string, stringLength;","      if (encoding == null) {","        encoding = \"ascii\";","      }","      if (move == null) {","        move = true;","      }","      if (this.isEnd()) {","        throw new Error(\"No data left\");","      }","      length = 4;","      nullSeen = false;","      while ((pos = this.pos + length - 1) &lt; this.buffer.byteLength) {","        if (this.view.getInt8(pos) === 0) {","          nullSeen = true;","          break;","        }","        length += 4;","      }","      if (length === 0 || nullSeen === false) {","        throw new Error(\"No string data found\");","      }","      stringLength = length - 4;","      while (stringLength &lt; length) {","        if (this.view.getInt8(this.pos + stringLength) === 0) {","          break;","        }","        stringLength++;","      }","      string = this.toString(encoding, this.pos, this.pos + stringLength);","      if (move) {","        this.pos += length;","      }","      return string;","    };","","    return OscArrayBufferPacketParser;","","  })(AbstractOscPacketParser);","","  _fn4 = function(type, desc) {","    return OscArrayBufferPacketParser.prototype[\"read\" + type] = function(move) {","      var value;","      if (move == null) {","        move = true;","      }","      value = this.view[desc.dataViewReader](this.pos, false);","      if (move) {","        this.pos += desc.size;","      }","      return value;","    };","  };","  for (type in NUMBERS) {","    desc = NUMBERS[type];","    _fn4(type, desc);","  }","","  OscBufferPacketParser = (function(_super) {","","    __extends(OscBufferPacketParser, _super);","","    function OscBufferPacketParser(buffer, pos, dict) {","      OscBufferPacketParser.__super__.constructor.apply(this, arguments);","    }","","    OscBufferPacketParser.prototype.isEnd = function() {","      return this.buffer.length === 0 || this.pos === this.buffer.length;","    };","","    OscBufferPacketParser.prototype.toString = function() {","      return this.buffer.toString.apply(this.buffer, arguments);","    };","","    OscBufferPacketParser.prototype.readBlob = function(move) {","      var buf, pad, size;","      if (move == null) {","        move = true;","      }","      size = this.readInt32();","      buf = new Buffer(size);","      this.buffer.copy(buf, 0, this.pos, this.pos + size);","      if (move) {","        pad = oscPadding(4 + size);","        if (pad &lt; 4) {","          size += pad;","        }","        this.pos += size;","      }","      return buf;","    };","","    OscBufferPacketParser.prototype.readString = function(encoding, move) {","      var length, nullSeen, pos, string, stringLength;","      if (encoding == null) {","        encoding = \"ascii\";","      }","      if (move == null) {","        move = true;","      }","      if (this.isEnd()) {","        throw new Error(\"No data left\");","      }","      length = 4;","      nullSeen = false;","      while ((pos = this.pos + length - 1) &lt; this.buffer.length) {","        if (this.buffer[pos] === 0) {","          nullSeen = true;","          break;","        }","        length += 4;","      }","      if (length === 0 || nullSeen === false) {","        throw new Error(\"No string data found\");","      }","      stringLength = length - 4;","      while (stringLength &lt; length) {","        if (this.buffer[this.pos + stringLength] === 0) {","          break;","        }","        stringLength++;","      }","      string = this.toString(encoding, this.pos, this.pos + stringLength);","      if (move) {","        this.pos += length;","      }","      return string;","    };","","    return OscBufferPacketParser;","","  })(AbstractOscPacketParser);","","  _fn5 = function(type, desc) {","    return OscBufferPacketParser.prototype[\"read\" + type] = function(move) {","      var value;","      if (move == null) {","        move = true;","      }","      value = this.buffer[desc.bufferReader](this.pos);","      if (move) {","        this.pos += desc.size;","      }","      return value;","    };","  };","  for (type in NUMBERS) {","    desc = NUMBERS[type];","    _fn5(type, desc);","  }","","  fromBuffer = function(buffer, pos, dict) {","    if (nodeBuffer &amp;&amp; Buffer.isBuffer(buffer)) {","      return new OscBufferPacketParser(buffer, pos, dict).parse();","    } else {","      return new OscArrayBufferPacketParser(buffer, pos, dict).parse();","    }","  };","","  exports = module.exports;","","  exports.NUMBERS = NUMBERS;","","  exports.toNTP = toNTP;","","  exports.Message = Message;","","  exports.Bundle = Bundle;","","  exports.Impulse = Impulse;","","  exports.AbstractOscPacketGenerator = AbstractOscPacketGenerator;","","  exports.AbstractOscPacketParser = AbstractOscPacketParser;","","  exports.OscBufferPacketGenerator = OscBufferPacketGenerator;","","  exports.OscBufferPacketParser = OscBufferPacketParser;","","  exports.OscArrayBufferPacketGenerator = OscArrayBufferPacketGenerator;","","  exports.OscArrayBufferPacketParser = OscArrayBufferPacketParser;","","  exports.fromBuffer = fromBuffer;","","}).call(this);"];

});

require.define("/node_modules/a2r-osc/lib-cov/a2r-osc/stream.js",function(require,module,exports,__dirname,__filename,process,global){/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['a2r-osc/stream.js']) {
  _$jscoverage['a2r-osc/stream.js'] = [];
  _$jscoverage['a2r-osc/stream.js'][2] = 0;
  _$jscoverage['a2r-osc/stream.js'][3] = 0;
  _$jscoverage['a2r-osc/stream.js'][5] = 0;
  _$jscoverage['a2r-osc/stream.js'][7] = 0;
  _$jscoverage['a2r-osc/stream.js'][9] = 0;
  _$jscoverage['a2r-osc/stream.js'][11] = 0;
  _$jscoverage['a2r-osc/stream.js'][13] = 0;
  _$jscoverage['a2r-osc/stream.js'][15] = 0;
  _$jscoverage['a2r-osc/stream.js'][16] = 0;
  _$jscoverage['a2r-osc/stream.js'][17] = 0;
  _$jscoverage['a2r-osc/stream.js'][18] = 0;
  _$jscoverage['a2r-osc/stream.js'][21] = 0;
  _$jscoverage['a2r-osc/stream.js'][22] = 0;
  _$jscoverage['a2r-osc/stream.js'][23] = 0;
  _$jscoverage['a2r-osc/stream.js'][24] = 0;
  _$jscoverage['a2r-osc/stream.js'][25] = 0;
  _$jscoverage['a2r-osc/stream.js'][26] = 0;
  _$jscoverage['a2r-osc/stream.js'][28] = 0;
  _$jscoverage['a2r-osc/stream.js'][31] = 0;
  _$jscoverage['a2r-osc/stream.js'][33] = 0;
  _$jscoverage['a2r-osc/stream.js'][36] = 0;
  _$jscoverage['a2r-osc/stream.js'][37] = 0;
  _$jscoverage['a2r-osc/stream.js'][38] = 0;
  _$jscoverage['a2r-osc/stream.js'][40] = 0;
  _$jscoverage['a2r-osc/stream.js'][43] = 0;
  _$jscoverage['a2r-osc/stream.js'][47] = 0;
  _$jscoverage['a2r-osc/stream.js'][49] = 0;
  _$jscoverage['a2r-osc/stream.js'][51] = 0;
  _$jscoverage['a2r-osc/stream.js'][52] = 0;
  _$jscoverage['a2r-osc/stream.js'][53] = 0;
  _$jscoverage['a2r-osc/stream.js'][54] = 0;
  _$jscoverage['a2r-osc/stream.js'][55] = 0;
  _$jscoverage['a2r-osc/stream.js'][58] = 0;
  _$jscoverage['a2r-osc/stream.js'][59] = 0;
  _$jscoverage['a2r-osc/stream.js'][60] = 0;
  _$jscoverage['a2r-osc/stream.js'][61] = 0;
  _$jscoverage['a2r-osc/stream.js'][62] = 0;
  _$jscoverage['a2r-osc/stream.js'][64] = 0;
  _$jscoverage['a2r-osc/stream.js'][65] = 0;
  _$jscoverage['a2r-osc/stream.js'][67] = 0;
  _$jscoverage['a2r-osc/stream.js'][70] = 0;
  _$jscoverage['a2r-osc/stream.js'][74] = 0;
  _$jscoverage['a2r-osc/stream.js'][76] = 0;
}
_$jscoverage['a2r-osc/stream.js'][2]++;
(function () {
  _$jscoverage['a2r-osc/stream.js'][3]++;
  var PackStream, UnpackStream, osc, stream, __hasProp = ({}).hasOwnProperty, __extends = (function (child, parent) {
  _$jscoverage['a2r-osc/stream.js'][5]++;
  for (var key in parent) {
    _$jscoverage['a2r-osc/stream.js'][5]++;
    if (__hasProp.call(parent, key)) {
      _$jscoverage['a2r-osc/stream.js'][5]++;
      child[key] = parent[key];
    }
}
  _$jscoverage['a2r-osc/stream.js'][5]++;
  function ctor() {
    _$jscoverage['a2r-osc/stream.js'][5]++;
    this.constructor = child;
}
  _$jscoverage['a2r-osc/stream.js'][5]++;
  ctor.prototype = parent.prototype;
  _$jscoverage['a2r-osc/stream.js'][5]++;
  child.prototype = new ctor();
  _$jscoverage['a2r-osc/stream.js'][5]++;
  child.__super__ = parent.prototype;
  _$jscoverage['a2r-osc/stream.js'][5]++;
  return child;
});
  _$jscoverage['a2r-osc/stream.js'][7]++;
  stream = require("stream");
  _$jscoverage['a2r-osc/stream.js'][9]++;
  osc = require("./osc");
  _$jscoverage['a2r-osc/stream.js'][11]++;
  UnpackStream = (function (_super) {
  _$jscoverage['a2r-osc/stream.js'][13]++;
  __extends(UnpackStream, _super);
  _$jscoverage['a2r-osc/stream.js'][15]++;
  function UnpackStream(dict) {
    _$jscoverage['a2r-osc/stream.js'][16]++;
    UnpackStream.__super__.constructor.call(this);
    _$jscoverage['a2r-osc/stream.js'][17]++;
    this.dict = dict;
    _$jscoverage['a2r-osc/stream.js'][18]++;
    this.writable = true;
}
  _$jscoverage['a2r-osc/stream.js'][21]++;
  UnpackStream.prototype.write = (function (buffer, encoding) {
  _$jscoverage['a2r-osc/stream.js'][22]++;
  var msg;
  _$jscoverage['a2r-osc/stream.js'][23]++;
  if (Buffer.isBuffer(buffer)) {
    _$jscoverage['a2r-osc/stream.js'][24]++;
    try {
      _$jscoverage['a2r-osc/stream.js'][25]++;
      msg = osc.fromBuffer(buffer, this.dict);
      _$jscoverage['a2r-osc/stream.js'][26]++;
      this.emit("message", msg);
    }
    catch (e) {
      _$jscoverage['a2r-osc/stream.js'][28]++;
      this.emit("error", e);
    }
  }
  else {
    _$jscoverage['a2r-osc/stream.js'][31]++;
    this.write(new Buffer(buffer, encoding));
  }
  _$jscoverage['a2r-osc/stream.js'][33]++;
  return true;
});
  _$jscoverage['a2r-osc/stream.js'][36]++;
  UnpackStream.prototype.end = (function (buffer, encoding) {
  _$jscoverage['a2r-osc/stream.js'][37]++;
  if (buffer) {
    _$jscoverage['a2r-osc/stream.js'][38]++;
    this.write(buffer, encoding);
  }
  _$jscoverage['a2r-osc/stream.js'][40]++;
  return this.emit("close");
});
  _$jscoverage['a2r-osc/stream.js'][43]++;
  return UnpackStream;
})(stream.Stream);
  _$jscoverage['a2r-osc/stream.js'][47]++;
  PackStream = (function (_super) {
  _$jscoverage['a2r-osc/stream.js'][49]++;
  __extends(PackStream, _super);
  _$jscoverage['a2r-osc/stream.js'][51]++;
  function PackStream(dict) {
    _$jscoverage['a2r-osc/stream.js'][52]++;
    PackStream.__super__.constructor.call(this);
    _$jscoverage['a2r-osc/stream.js'][53]++;
    this.dict = dict;
    _$jscoverage['a2r-osc/stream.js'][54]++;
    this.writable = false;
    _$jscoverage['a2r-osc/stream.js'][55]++;
    this.readable = true;
}
  _$jscoverage['a2r-osc/stream.js'][58]++;
  PackStream.prototype.send = (function (message) {
  _$jscoverage['a2r-osc/stream.js'][59]++;
  var buffer;
  _$jscoverage['a2r-osc/stream.js'][60]++;
  try {
    _$jscoverage['a2r-osc/stream.js'][61]++;
    buffer = message.toBuffer(this.dict);
    _$jscoverage['a2r-osc/stream.js'][62]++;
    this.emit("data", buffer);
  }
  catch (e) {
    _$jscoverage['a2r-osc/stream.js'][64]++;
    this.emit("error", e);
    _$jscoverage['a2r-osc/stream.js'][65]++;
    return false;
  }
  _$jscoverage['a2r-osc/stream.js'][67]++;
  return true;
});
  _$jscoverage['a2r-osc/stream.js'][70]++;
  return PackStream;
})(stream.Stream);
  _$jscoverage['a2r-osc/stream.js'][74]++;
  module.exports.UnpackStream = UnpackStream;
  _$jscoverage['a2r-osc/stream.js'][76]++;
  module.exports.PackStream = PackStream;
}).call(this);
_$jscoverage['a2r-osc/stream.js'].source = ["// Generated by CoffeeScript 1.4.0","(function() {","  var PackStream, UnpackStream, osc, stream,","    __hasProp = {}.hasOwnProperty,","    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };","","  stream = require(\"stream\");","","  osc = require(\"./osc\");","","  UnpackStream = (function(_super) {","","    __extends(UnpackStream, _super);","","    function UnpackStream(dict) {","      UnpackStream.__super__.constructor.call(this);","      this.dict = dict;","      this.writable = true;","    }","","    UnpackStream.prototype.write = function(buffer, encoding) {","      var msg;","      if (Buffer.isBuffer(buffer)) {","        try {","          msg = osc.fromBuffer(buffer, this.dict);","          this.emit(\"message\", msg);","        } catch (e) {","          this.emit(\"error\", e);","        }","      } else {","        this.write(new Buffer(buffer, encoding));","      }","      return true;","    };","","    UnpackStream.prototype.end = function(buffer, encoding) {","      if (buffer) {","        this.write(buffer, encoding);","      }","      return this.emit(\"close\");","    };","","    return UnpackStream;","","  })(stream.Stream);","","  PackStream = (function(_super) {","","    __extends(PackStream, _super);","","    function PackStream(dict) {","      PackStream.__super__.constructor.call(this);","      this.dict = dict;","      this.writable = false;","      this.readable = true;","    }","","    PackStream.prototype.send = function(message) {","      var buffer;","      try {","        buffer = message.toBuffer(this.dict);","        this.emit(\"data\", buffer);","      } catch (e) {","        this.emit(\"error\", e);","        return false;","      }","      return true;","    };","","    return PackStream;","","  })(stream.Stream);","","  module.exports.UnpackStream = UnpackStream;","","  module.exports.PackStream = PackStream;","","}).call(this);"];

});

require.define("stream",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

});

require.define("util",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');

exports.isArray = isArray;
exports.isDate = function(obj){return Object.prototype.toString.call(obj) === '[object Date]'};
exports.isRegExp = function(obj){return Object.prototype.toString.call(obj) === '[object RegExp]'};


exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(exports.inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      default:
        return x;
    }
  });
  for(var x = args[i]; i < len; x = args[++i]){
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + exports.inspect(x);
    }
  }
  return str;
};

});

require.define("/node_modules/a2r-osc/src/a2r-osc/index.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var stream;

  module.exports = require("./osc");

  stream = require("./stream");

  module.exports.UnpackStream = stream.UnpackStream;

  module.exports.PackStream = stream.PackStream;

}).call(this);

});

require.define("/node_modules/a2r-osc/src/a2r-osc/osc.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var AbstractOscPacketGenerator, AbstractOscPacketParser, Bundle, Impulse, Message, NUMBERS, OSC_TYPES, OSC_TYPES_BY_NAME, OscArrayBufferPacketGenerator, OscArrayBufferPacketParser, OscBufferPacketGenerator, OscBufferPacketParser, SECONDS_FROM_1900_to_1970, code, desc, exports, fromBuffer, fromNTP, name, nodeBuffer, oscPadding, oscSizeOf, oscSizeOfBlob, oscSizeOfBundle, oscSizeOfMessage, oscSizeOfString, oscTypeCodeOf, toInteger, toNTP, toNumber, type, _fn, _fn1, _fn2, _fn3, _fn4, _fn5,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  nodeBuffer = typeof Buffer === 'function';

  toNumber = function(val) {
    val = Number(val);
    if (val === NaN) {
      throw new Error("Value isn't a number");
    }
    return val;
  };

  toInteger = function(val) {
    val = toNumber(val);
    return Math.round(val);
  };

  SECONDS_FROM_1900_to_1970 = 2208988800;

  fromNTP = function(seconds, fraction) {
    var date, ms;
    if (seconds === 0 && fraction === 1) {
      return new Date;
    }
    ms = (seconds - SECONDS_FROM_1900_to_1970) * 1000;
    ms += Math.round(1000 * fraction / 0x100000000);
    date = new Date(ms);
    date.ntpSeconds = seconds;
    date.ntpFraction = fraction;
    return date;
  };

  toNTP = function(date) {
    var fraction, seconds, time;
    if (date === 1) {
      return [0, 1];
    }
    if (Array.isArray(date)) {
      return date;
    }
    time = date.getTime();
    seconds = Math.floor(time / 1000);
    fraction = Math.round(((time % 1000) * 0x100000000) / 1000);
    return [seconds + SECONDS_FROM_1900_to_1970, fraction];
  };

  OSC_TYPES = {
    i: {
      name: "integer",
      read: function(reader) {
        return reader.readInt32();
      },
      write: function(writer, value) {
        return writer.writeInt32(value);
      },
      cast: toInteger,
      sizeOf: function(value) {
        return 4;
      }
    },
    f: {
      name: "float",
      read: function(reader) {
        return reader.readFloat();
      },
      write: function(writer, value) {
        return writer.writeFloat(value);
      },
      cast: toNumber,
      sizeOf: function(value) {
        return 4;
      }
    },
    s: {
      name: "string",
      read: function(reader) {
        return reader.readString();
      },
      write: function(writer, value) {
        return writer.writeString(value);
      },
      cast: function(value) {
        return value.toString();
      },
      sizeOf: function(value) {
        return oscSizeOfString(value.toString());
      }
    },
    b: {
      name: "blob",
      read: function(reader) {
        return reader.readBlob();
      },
      write: function(writer, value) {
        return writer.writeBlob(value);
      },
      sizeOf: function(value) {
        return oscSizeOfBlob(value);
      }
    },
    d: {
      name: "double",
      read: function(reader) {
        return reader.readDouble();
      },
      write: function(writer, value) {
        return writer.writeDouble(value);
      },
      sizeOf: function(value) {
        return 8;
      }
    },
    c: {
      name: "char",
      read: function(reader) {
        return String.fromCharCode(reader.readInt32() & 0x7F);
      },
      write: function(writer, value) {
        return writer.writeInt32(value.charCodeAt(0));
      },
      cast: function(value) {
        return value.toString().charAt(0);
      },
      sizeOf: function(value) {
        return 4;
      }
    },
    r: {
      name: "color",
      read: function(reader) {
        return reader.readInt32();
      },
      write: function(writer, value) {
        return writer.writeInt32(value);
      },
      cast: toInteger,
      sizeOf: function(value) {
        return 4;
      }
    },
    t: {
      name: "time",
      read: function(reader) {
        return reader.readTimetag();
      },
      write: function(writer, value) {
        return writer.writeTimetag(value);
      },
      cast: toNTP,
      sizeOf: function() {
        return 8;
      }
    },
    T: {
      name: "true",
      read: function() {
        return true;
      }
    },
    F: {
      name: "false",
      read: function() {
        return false;
      }
    },
    N: {
      name: "null",
      read: function() {
        return null;
      }
    },
    I: {
      name: "impulse",
      read: function() {
        return Impulse;
      }
    }
  };

  OSC_TYPES.S = OSC_TYPES.s;

  OSC_TYPES_BY_NAME = {};

  for (code in OSC_TYPES) {
    type = OSC_TYPES[code];
    if (code !== 'S') {
      type.code = code;
    }
    OSC_TYPES_BY_NAME[type.name] = type;
  }

  NUMBERS = {
    Int32: {
      dataViewReader: "getInt32",
      dataViewWriter: "setInt32",
      bufferReader: "readInt32BE",
      bufferWriter: "writeInt32BE",
      size: 4
    },
    UInt32: {
      dataViewReader: "getUint32",
      dataViewWriter: "setUint32",
      bufferReader: "readUInt32BE",
      bufferWriter: "writeUInt32BE",
      size: 4
    },
    Float: {
      dataViewReader: "getFloat32",
      dataViewWriter: "setFloat32",
      bufferReader: "readFloatBE",
      bufferWriter: "writeFloatBE",
      size: 4
    },
    Double: {
      dataViewReader: "getFloat64",
      dataViewWriter: "setFloat64",
      bufferReader: "readDoubleBE",
      bufferWriter: "writeDoubleBE",
      size: 8
    }
  };

  oscPadding = function(len) {
    return 4 - len % 4;
  };

  Impulse = new Object;

  oscTypeCodeOf = function(val) {
    switch (typeof val) {
      case 'string':
        return 's';
      case 'number':
        return 'f';
      case 'boolean':
        if (val) {
          return 'T';
        } else {
          return 'F';
        }
        break;
      case 'undefined':
        throw new Error("Value can't be undefined");
        break;
      case 'object':
        if (val === null) {
          return 'N';
        } else if (val instanceof Date) {
          return 't';
        } else if ((nodeBuffer && Buffer.isBuffer(val)) || val instanceof ArrayBuffer) {
          return 'b';
        } else if (val === Impulse) {
          return 'I';
        } else {
          throw new Error("Unsupported type `" + val + "`");
        }
        break;
      default:
        throw new Error("Unsupported type `" + val + "`");
    }
  };

  oscSizeOfString = function(str) {
    return str.length + oscPadding(str.length);
  };

  oscSizeOfBlob = function(buf) {
    var length, pad;
    if (buf instanceof ArrayBuffer) {
      length = 4 + buf.byteLength;
    } else {
      length = 4 + buf.length;
    }
    pad = oscPadding(length);
    if (pad < 4) {
      length += pad;
    }
    return length;
  };

  oscSizeOfBundle = function(bundle, dict) {
    var elem, size, _i, _len, _ref;
    size = 16;
    _ref = bundle.elements;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      elem = _ref[_i];
      size += 4 + oscSizeOfMessage(elem, dict);
    }
    return size;
  };

  oscSizeOfMessage = function(msg, dict) {
    var addressId, i, l, size, tl, typeCode, value;
    addressId = dict != null ? dict[msg.address] : void 0;
    if (addressId) {
      size = 8;
    } else {
      size = oscSizeOfString(msg.address);
    }
    if (addressId) {
      tl = msg.typeTag.length + 2;
    } else {
      tl = msg.typeTag.length + 1;
    }
    size += tl + oscPadding(tl);
    i = 0;
    l = msg.typeTag.length;
    while (i < l) {
      typeCode = msg.typeTag.charAt(i);
      value = msg["arguments"][i++];
      size += oscSizeOf(value, typeCode);
    }
    return size;
  };

  oscSizeOf = function(value, code) {
    if (code) {
      type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
      if (!type) {
        throw new Error("Type `" + code + "` isn't supported");
      }
      if (!type.sizeOf) {
        return 0;
      }
      return type.sizeOf(value);
    } else {
      code = oscTypeCodeOf(value);
      return oscSizeOf(value, code);
    }
  };

  Message = (function() {

    function Message(address, typeTag, args) {
      var value;
      this.address = address;
      if (typeTag && !(args != null)) {
        args = typeTag;
        typeTag = null;
      }
      if (!Array.isArray(args)) {
        args = [args];
      }
      if (typeTag) {
        this.typeTag = typeTag;
        this["arguments"] = args;
      } else {
        this.typeTag = "";
        this["arguments"] = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = args.length; _i < _len; _i++) {
            value = args[_i];
            if (typeof value === 'object' && ((value != null ? value.type : void 0) != null)) {
              code = value.type;
              type = OSC_TYPES[code] || OSC_TYPES_BY_NAME[code];
              if (!type) {
                throw new Error("Type `" + code + "` isn't supported");
              }
              this.typeTag += type.code;
              if (type.sizeOf) {
                _results.push(value.value);
              } else {
                _results.push(type.read());
              }
            } else {
              this.typeTag += oscTypeCodeOf(value);
              _results.push(value);
            }
          }
          return _results;
        }).call(this);
      }
      if (this["arguments"].length !== this.typeTag.length) {
        throw new Error("Arguments doesn't match typetag");
      }
    }

    Message.prototype.toBuffer = function(dict) {
      if (nodeBuffer) {
        return new OscBufferPacketGenerator(this, dict).generate();
      } else {
        return new OscArrayBufferPacketGenerator(this, dict).generate();
      }
    };

    Message.prototype.equal = function(other) {
      var arg, i, _i, _len, _ref;
      if (!(other instanceof Message)) {
        return false;
      }
      if (other.address !== this.address) {
        return false;
      }
      if (other.typeTag !== this.typeTag) {
        return false;
      }
      if (other["arguments"].length !== this["arguments"].length) {
        return false;
      }
      _ref = this["arguments"];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        arg = _ref[i];
        if (other["arguments"][i] !== arg) {
          return false;
        }
      }
      return true;
    };

    return Message;

  })();

  Bundle = (function() {

    function Bundle(timetag, elements) {
      var elem, _i, _len, _ref;
      if (timetag instanceof Date) {
        this.timetag = timetag;
      } else if (timetag === 1) {
        this.timetag = new Date;
      } else {
        this.timetag = new Date;
        elements = timetag;
      }
      if (elements) {
        if (!Array.isArray(elements)) {
          elements = [elements];
        }
        this.elements = elements;
      } else {
        this.elements = [];
      }
      _ref = this.elements;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        if (!elem instanceof Message) {
          throw new Error("A bundle element must be an instance of Message");
        }
      }
      null;
    }

    Bundle.prototype.addElement = function(address, typeTag, args) {
      var msg;
      if (address instanceof Message) {
        this.elements.push(address);
        return address;
      } else {
        msg = new Message(address, typeTag, args);
        this.elements.push(msg);
        return msg;
      }
    };

    Bundle.prototype.message = function(address, typeTag, args) {
      this.addElement(address, typeTag, args);
      return this;
    };

    Bundle.prototype.toBuffer = function(dict) {
      if (nodeBuffer) {
        return new OscBufferPacketGenerator(this, dict).generate();
      } else {
        return new OscArrayBufferPacketGenerator(this, dict).generate();
      }
    };

    Bundle.prototype.equal = function(other) {
      var elem, i, _i, _len, _ref;
      if (!(other instanceof Bundle)) {
        return false;
      }
      if (other.timetag !== this.timetag) {
        return false;
      }
      if (other.elements.length !== this.elements.length) {
        return false;
      }
      _ref = this.elements;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        elem = _ref[i];
        if (!elem.equal(other.elements[i])) {
          return false;
        }
      }
      return true;
    };

    return Bundle;

  })();

  AbstractOscPacketGenerator = (function() {

    function AbstractOscPacketGenerator(messageOrBundle, dict) {
      this.dict = dict;
      if (messageOrBundle instanceof Bundle) {
        this.bundle = messageOrBundle;
        this.size = oscSizeOfBundle(this.bundle, this.dict);
      } else {
        this.message = messageOrBundle;
        this.size = oscSizeOfMessage(this.message, this.dict);
      }
    }

    AbstractOscPacketGenerator.prototype.generateMessage = function(msg) {
      var addressId, i, l, value, _results;
      if (this.dict && (addressId = this.dict[msg.address])) {
        this.writeUInt32(0x2f000000);
        this.writeString(",i" + msg.typeTag);
        this.writeInt32(toInteger(addressId));
      } else {
        this.writeString(msg.address);
        this.writeString("," + msg.typeTag);
      }
      i = 0;
      l = msg.typeTag.length;
      _results = [];
      while (i < l) {
        code = msg.typeTag.charAt(i);
        value = msg["arguments"][i++];
        type = OSC_TYPES[code];
        if (!type) {
          throw new Error("Type `" + code + "` isn't supported");
        }
        if (type.write) {
          if (type.cast) {
            value = type.cast(value);
          }
          _results.push(type.write(this, value));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    AbstractOscPacketGenerator.prototype.generateBundle = function(bundle) {
      var elem, tag, _i, _len, _ref;
      this.writeString("#bundle");
      if (bundle.timetag <= new Date) {
        tag = [0, 1];
      } else {
        tag = toNTP(bundle.timetag);
      }
      this.writeTimetag(tag);
      _ref = bundle.elements;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        elem = _ref[_i];
        this.writeInt32(oscSizeOfMessage(elem, this.dict));
        this.generateMessage(elem);
      }
      return null;
    };

    AbstractOscPacketGenerator.prototype.writeTimetag = function(tag) {
      this.writeUInt32(tag[0]);
      return this.writeUInt32(tag[1]);
    };

    AbstractOscPacketGenerator.prototype.generate = function() {
      if (this.bundle) {
        this.generateBundle(this.bundle);
      } else {
        this.generateMessage(this.message);
      }
      return this.buffer;
    };

    AbstractOscPacketGenerator.prototype.writeString = function(string, encoding) {
      if (encoding == null) {
        encoding = "ascii";
      }
      throw new Error("Abstract method `AbstractOscPacketGenerator::writeString` called");
    };

    return AbstractOscPacketGenerator;

  })();

  _fn = function(name) {
    name = "write" + name;
    return AbstractOscPacketGenerator.prototype[name] = function() {
      throw new Error("Abstract method `AbstractOscPacketGenerator::" + name + "` called");
    };
  };
  for (name in NUMBERS) {
    desc = NUMBERS[name];
    _fn(name);
  }

  OscArrayBufferPacketGenerator = (function(_super) {

    __extends(OscArrayBufferPacketGenerator, _super);

    function OscArrayBufferPacketGenerator(messageOrBundle, dict) {
      OscArrayBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
      this.buffer = new ArrayBuffer(this.size);
      this.view = new DataView(this.buffer);
      this.pos = 0;
    }

    OscArrayBufferPacketGenerator.prototype.writeString = function(string, encoding) {
      var char, i, l, pad, _results;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (encoding !== "ascii") {
        throw new Error("OscBufferWriter::writeString only supports ASCII encoding for ArrayBuffer");
      }
      l = string.length;
      i = 0;
      while (i < l) {
        char = string.charCodeAt(i++);
        this.view.setInt8(this.pos++, char & 0x7F);
      }
      pad = oscPadding(l);
      i = 0;
      _results = [];
      while (i < pad) {
        this.view.setInt8(this.pos++, 0);
        _results.push(i++);
      }
      return _results;
    };

    OscArrayBufferPacketGenerator.prototype.writeBlob = function(buffer) {
      var array, i, l, pad;
      if (nodeBuffer && Buffer.isBuffer(buffer)) {
        l = buffer.length;
        this.writeInt32(l);
        i = 0;
        while (i < l) {
          this.view.setInt8(this.pos + i, buffer[i]);
          i++;
        }
        this.pos += l;
      } else {
        l = buffer.byteLength;
        array = new Int8Array(buffer);
        this.writeInt32(l);
        i = 0;
        while (i < l) {
          this.view.setInt8(this.pos + i, array[i]);
          i++;
        }
        this.pos += l;
      }
      pad = oscPadding(4 + l);
      if (pad && pad < 4) {
        i = 0;
        while (i < pad) {
          this.view.setInt8(this.pos + i, 0);
          i++;
        }
        return this.pos += pad;
      }
    };

    return OscArrayBufferPacketGenerator;

  })(AbstractOscPacketGenerator);

  _fn1 = function(type, desc) {
    return OscArrayBufferPacketGenerator.prototype["write" + type] = function(value) {
      value = this.view[desc.dataViewWriter](this.pos, value, false);
      this.pos += desc.size;
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn1(type, desc);
  }

  OscBufferPacketGenerator = (function(_super) {

    __extends(OscBufferPacketGenerator, _super);

    function OscBufferPacketGenerator(messageOrBundle, dict) {
      OscBufferPacketGenerator.__super__.constructor.call(this, messageOrBundle, dict);
      this.buffer = new Buffer(this.size);
      this.pos = 0;
    }

    OscBufferPacketGenerator.prototype.writeString = function(string, encoding) {
      var length, pad;
      if (encoding == null) {
        encoding = "ascii";
      }
      length = Buffer.byteLength(string, encoding);
      this.buffer.write(string, this.pos, length, encoding);
      this.pos += length;
      pad = oscPadding(length);
      this.buffer.fill(0, this.pos, this.pos + pad);
      return this.pos += pad;
    };

    OscBufferPacketGenerator.prototype.writeBlob = function(buffer) {
      var array, i, length, pad;
      if (buffer instanceof ArrayBuffer) {
        length = buffer.byteLength;
        this.writeInt32(length);
        array = new Int8Array(buffer);
        i = 0;
        while (i < length) {
          this.buffer[this.pos + i] = array[i];
          i++;
        }
      } else {
        length = buffer.length;
        this.writeInt32(length);
        buffer.copy(this.buffer, this.pos);
      }
      pad = oscPadding(4 + length);
      this.pos += length;
      if (pad && pad < 4) {
        this.buffer.fill(0, this.pos, this.pos + pad);
        return this.pos += pad;
      }
    };

    return OscBufferPacketGenerator;

  })(AbstractOscPacketGenerator);

  _fn2 = function(type, desc) {
    return OscBufferPacketGenerator.prototype["write" + type] = function(value) {
      value = this.buffer[desc.bufferWriter](value, this.pos);
      this.pos += desc.size;
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn2(type, desc);
  }

  AbstractOscPacketParser = (function() {

    function AbstractOscPacketParser(buffer, pos, dict) {
      if (pos == null) {
        pos = 0;
      }
      this.buffer = buffer;
      if (typeof pos === "object") {
        this.dict = pos;
        this.pos = 0;
      } else {
        this.dict = dict;
        this.pos = pos;
      }
    }

    AbstractOscPacketParser.prototype.parse = function() {
      var address;
      address = this.readString();
      if (address === "#bundle") {
        return this._parseBundle();
      } else {
        return this._parseMessage(address);
      }
    };

    AbstractOscPacketParser.prototype._parseMessage = function(address) {
      var addressId, args, typeTag;
      if (address.charAt(0) !== '/') {
        throw new Error("A address must start with a '/'");
      }
      if (this.dict && (address === "/" || address === "/?")) {
        typeTag = this.readTypeTag();
        args = this.parseArguments(typeTag);
        if (typeTag.charAt(0) !== 'i') {
          throw new Error("Messages with compressed addresses must have an integer as first arguments type");
        }
        typeTag = typeTag.slice(1, 1);
        addressId = args.shift();
        address = this.dict[addressId];
        if (!address) {
          throw new Error("No address with id `" + addressId + "` found");
        }
      } else {
        typeTag = this.readTypeTag();
        args = this.parseArguments(typeTag);
      }
      return new Message(address, typeTag, args);
    };

    AbstractOscPacketParser.prototype._parseBundle = function() {
      var boundary, elements, size, timetag;
      timetag = this.readTimetag();
      elements = [];
      while (!this.isEnd()) {
        size = this.readInt32();
        boundary = this.pos + size;
        elements.push(this.parse());
      }
      return new Bundle(timetag, elements);
    };

    AbstractOscPacketParser.prototype.parseArguments = function(tag, boundary) {
      var i, values;
      i = 0;
      values = [];
      while (i < tag.length) {
        if (boundary && this.pos >= boundary) {
          throw new Error("Message boundary reached");
        }
        code = tag.charAt(i++);
        type = OSC_TYPES[code];
        if (!type) {
          throw new Error("Type `" + code + "` isn't supported");
        }
        values.push(type.read(this));
      }
      return values;
    };

    AbstractOscPacketParser.prototype.readTypeTag = function() {
      var tag;
      tag = this.readString();
      if (tag.charAt(0) === ',') {
        tag = tag.slice(1);
      } else {
        throw new Error("A type tag must start with a ','");
      }
      return tag;
    };

    AbstractOscPacketParser.prototype.readTimetag = function() {
      return fromNTP(this.readUInt32(), this.readUInt32());
    };

    AbstractOscPacketParser.prototype.readString = function(encoding, move) {
      throw new Error("Abstract method `AbstractOscPacketParser::writeString` called");
    };

    AbstractOscPacketParser.prototype.isEnd = function() {
      throw new Error("Abstract method `AbstractOscPacketParser::isEnd` called");
    };

    return AbstractOscPacketParser;

  })();

  _fn3 = function(name) {
    name = "read" + name;
    return AbstractOscPacketParser.prototype[name] = function() {
      throw new Error("Abstract method `AbstractOscPacketParser::" + name + "` called");
    };
  };
  for (name in NUMBERS) {
    desc = NUMBERS[name];
    _fn3(name);
  }

  OscArrayBufferPacketParser = (function(_super) {

    __extends(OscArrayBufferPacketParser, _super);

    function OscArrayBufferPacketParser(buffer, pos, dict) {
      OscArrayBufferPacketParser.__super__.constructor.apply(this, arguments);
      this.view = new DataView(this.buffer);
    }

    OscArrayBufferPacketParser.prototype.isEnd = function() {
      return this.buffer.byteLength === 0 || this.pos === this.buffer.byteLength;
    };

    OscArrayBufferPacketParser.prototype.toString = function(encoding, start, end) {
      var charCode, str;
      start = start != null ? start : 0;
      end = end != null ? end : this.buffer.byteLength;
      str = "";
      while (start < end) {
        charCode = this.view.getInt8(start++);
        str += String.fromCharCode(charCode & 0x7F);
      }
      return str;
    };

    OscArrayBufferPacketParser.prototype.readBlob = function(move) {
      var array, i, pad, size;
      if (move == null) {
        move = true;
      }
      size = this.readInt32();
      i = 0;
      array = new Int8Array(new ArrayBuffer(size));
      while (i < size) {
        array[i] = this.view.getInt8(this.pos + i);
        i++;
      }
      if (move) {
        pad = oscPadding(4 + size);
        if (pad < 4) {
          size += pad;
        }
        this.pos += size;
      }
      return array.buffer;
    };

    OscArrayBufferPacketParser.prototype.readString = function(encoding, move) {
      var length, nullSeen, pos, string, stringLength;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (move == null) {
        move = true;
      }
      if (this.isEnd()) {
        throw new Error("No data left");
      }
      length = 4;
      nullSeen = false;
      while ((pos = this.pos + length - 1) < this.buffer.byteLength) {
        if (this.view.getInt8(pos) === 0) {
          nullSeen = true;
          break;
        }
        length += 4;
      }
      if (length === 0 || nullSeen === false) {
        throw new Error("No string data found");
      }
      stringLength = length - 4;
      while (stringLength < length) {
        if (this.view.getInt8(this.pos + stringLength) === 0) {
          break;
        }
        stringLength++;
      }
      string = this.toString(encoding, this.pos, this.pos + stringLength);
      if (move) {
        this.pos += length;
      }
      return string;
    };

    return OscArrayBufferPacketParser;

  })(AbstractOscPacketParser);

  _fn4 = function(type, desc) {
    return OscArrayBufferPacketParser.prototype["read" + type] = function(move) {
      var value;
      if (move == null) {
        move = true;
      }
      value = this.view[desc.dataViewReader](this.pos, false);
      if (move) {
        this.pos += desc.size;
      }
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn4(type, desc);
  }

  OscBufferPacketParser = (function(_super) {

    __extends(OscBufferPacketParser, _super);

    function OscBufferPacketParser(buffer, pos, dict) {
      OscBufferPacketParser.__super__.constructor.apply(this, arguments);
    }

    OscBufferPacketParser.prototype.isEnd = function() {
      return this.buffer.length === 0 || this.pos === this.buffer.length;
    };

    OscBufferPacketParser.prototype.toString = function() {
      return this.buffer.toString.apply(this.buffer, arguments);
    };

    OscBufferPacketParser.prototype.readBlob = function(move) {
      var buf, pad, size;
      if (move == null) {
        move = true;
      }
      size = this.readInt32();
      buf = new Buffer(size);
      this.buffer.copy(buf, 0, this.pos, this.pos + size);
      if (move) {
        pad = oscPadding(4 + size);
        if (pad < 4) {
          size += pad;
        }
        this.pos += size;
      }
      return buf;
    };

    OscBufferPacketParser.prototype.readString = function(encoding, move) {
      var length, nullSeen, pos, string, stringLength;
      if (encoding == null) {
        encoding = "ascii";
      }
      if (move == null) {
        move = true;
      }
      if (this.isEnd()) {
        throw new Error("No data left");
      }
      length = 4;
      nullSeen = false;
      while ((pos = this.pos + length - 1) < this.buffer.length) {
        if (this.buffer[pos] === 0) {
          nullSeen = true;
          break;
        }
        length += 4;
      }
      if (length === 0 || nullSeen === false) {
        throw new Error("No string data found");
      }
      stringLength = length - 4;
      while (stringLength < length) {
        if (this.buffer[this.pos + stringLength] === 0) {
          break;
        }
        stringLength++;
      }
      string = this.toString(encoding, this.pos, this.pos + stringLength);
      if (move) {
        this.pos += length;
      }
      return string;
    };

    return OscBufferPacketParser;

  })(AbstractOscPacketParser);

  _fn5 = function(type, desc) {
    return OscBufferPacketParser.prototype["read" + type] = function(move) {
      var value;
      if (move == null) {
        move = true;
      }
      value = this.buffer[desc.bufferReader](this.pos);
      if (move) {
        this.pos += desc.size;
      }
      return value;
    };
  };
  for (type in NUMBERS) {
    desc = NUMBERS[type];
    _fn5(type, desc);
  }

  fromBuffer = function(buffer, pos, dict) {
    if (nodeBuffer && Buffer.isBuffer(buffer)) {
      return new OscBufferPacketParser(buffer, pos, dict).parse();
    } else {
      return new OscArrayBufferPacketParser(buffer, pos, dict).parse();
    }
  };

  exports = module.exports;

  exports.NUMBERS = NUMBERS;

  exports.toNTP = toNTP;

  exports.Message = Message;

  exports.Bundle = Bundle;

  exports.Impulse = Impulse;

  exports.AbstractOscPacketGenerator = AbstractOscPacketGenerator;

  exports.AbstractOscPacketParser = AbstractOscPacketParser;

  exports.OscBufferPacketGenerator = OscBufferPacketGenerator;

  exports.OscBufferPacketParser = OscBufferPacketParser;

  exports.OscArrayBufferPacketGenerator = OscArrayBufferPacketGenerator;

  exports.OscArrayBufferPacketParser = OscArrayBufferPacketParser;

  exports.fromBuffer = fromBuffer;

}).call(this);

});

require.define("/node_modules/a2r-osc/src/a2r-osc/stream.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var PackStream, UnpackStream, osc, stream,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  stream = require("stream");

  osc = require("./osc");

  UnpackStream = (function(_super) {

    __extends(UnpackStream, _super);

    function UnpackStream(dict) {
      UnpackStream.__super__.constructor.call(this);
      this.dict = dict;
      this.writable = true;
    }

    UnpackStream.prototype.write = function(buffer, encoding) {
      var msg;
      if (Buffer.isBuffer(buffer)) {
        try {
          msg = osc.fromBuffer(buffer, this.dict);
          this.emit("message", msg);
        } catch (e) {
          this.emit("error", e);
        }
      } else {
        this.write(new Buffer(buffer, encoding));
      }
      return true;
    };

    UnpackStream.prototype.end = function(buffer, encoding) {
      if (buffer) {
        this.write(buffer, encoding);
      }
      return this.emit("close");
    };

    return UnpackStream;

  })(stream.Stream);

  PackStream = (function(_super) {

    __extends(PackStream, _super);

    function PackStream(dict) {
      PackStream.__super__.constructor.call(this);
      this.dict = dict;
      this.writable = false;
      this.readable = true;
    }

    PackStream.prototype.send = function(message) {
      var buffer;
      try {
        buffer = message.toBuffer(this.dict);
        this.emit("data", buffer);
      } catch (e) {
        this.emit("error", e);
        return false;
      }
      return true;
    };

    return PackStream;

  })(stream.Stream);

  module.exports.UnpackStream = UnpackStream;

  module.exports.PackStream = PackStream;

}).call(this);

});

require.define("/node_modules/a2r-osc/lib/a2r-osc/index.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.4.0
(function() {
  var stream;

  module.exports = require("./osc");

  stream = require("./stream");

  module.exports.UnpackStream = stream.UnpackStream;

  module.exports.PackStream = stream.PackStream;

}).call(this);

});

require.define("/node_modules/a2r-osc/lib/a2r-osc/stream.js",function(require,module,exports,__dirname,__filename,process,global){// Generated by CoffeeScript 1.4.0
(function() {
  var PackStream, UnpackStream, osc, stream,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  stream = require("stream");

  osc = require("./osc");

  UnpackStream = (function(_super) {

    __extends(UnpackStream, _super);

    function UnpackStream(dict) {
      UnpackStream.__super__.constructor.call(this);
      this.dict = dict;
      this.writable = true;
    }

    UnpackStream.prototype.write = function(buffer, encoding) {
      var msg;
      if (Buffer.isBuffer(buffer)) {
        try {
          msg = osc.fromBuffer(buffer, this.dict);
          this.emit("message", msg);
        } catch (e) {
          this.emit("error", e);
        }
      } else {
        this.write(new Buffer(buffer, encoding));
      }
      return true;
    };

    UnpackStream.prototype.end = function(buffer, encoding) {
      if (buffer) {
        this.write(buffer, encoding);
      }
      return this.emit("close");
    };

    return UnpackStream;

  })(stream.Stream);

  PackStream = (function(_super) {

    __extends(PackStream, _super);

    function PackStream(dict) {
      PackStream.__super__.constructor.call(this);
      this.dict = dict;
      this.writable = false;
      this.readable = true;
    }

    PackStream.prototype.send = function(message) {
      var buffer;
      try {
        buffer = message.toBuffer(this.dict);
        this.emit("data", buffer);
      } catch (e) {
        this.emit("error", e);
        return false;
      }
      return true;
    };

    return PackStream;

  })(stream.Stream);

  module.exports.UnpackStream = UnpackStream;

  module.exports.PackStream = PackStream;

}).call(this);

});

require.define("/src/a2r-hub/hub.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var EventEmitter, Hub, Session, Tree, address, osc,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  EventEmitter = require("events").EventEmitter;

  Tree = require("./tree");

  address = require("./address");

  osc = require("a2r-osc");

  Hub = (function(_super) {

    __extends(Hub, _super);

    Hub.osc = osc;

    function Hub() {
      Hub.__super__.constructor.call(this);
      this.sessionById = {};
      this.sessions = [];
    }

    Hub.prototype.shutdown = function() {
      var session, _i, _len, _ref;
      this.emit("shutdown");
      if (this.sessions) {
        _ref = this.sessions.slice(0);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          session = _ref[_i];
          session.close();
        }
      }
      return this.removeAllListeners();
    };

    Hub.prototype.getSession = function(id) {
      return this.sessionById[id];
    };

    Hub.prototype.registerSession = function(session) {
      if (this.sessionById[session.id]) {
        throw new Error("Session with id `" + id + "` already exist");
      }
      this.sessionById[session.id] = session;
      return this.sessions.push(session);
    };

    Hub.prototype.unregisterSession = function(session) {
      var id, index;
      id = session instanceof Session ? session.id : session;
      if ((session = this.sessionById[id])) {
        delete this.sessionById[id];
        index = this.sessions.indexOf(session);
        if (index > -1) {
          this.sessions.splice(index, 1);
        }
        return true;
      }
      return false;
    };

    Hub.prototype.createSession = function(data) {
      var session;
      session = new Session(this, data);
      this.registerSession(session);
      this.emit("session", session);
      return session;
    };

    Hub.prototype._sendBundle = function(bundle) {
      var date, element, timeout, _i, _len, _ref, _results,
        _this = this;
      date = new Date;
      if (bundle.timetag <= date) {
        console.log("received bundle", bundle);
        _ref = bundle.elements;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          element = _ref[_i];
          _results.push(this.send(element));
        }
        return _results;
      } else {
        timeout = bundle.timetag - date;
        console.log("set timeout for bundle", timeout, bundle);
        return setTimeout((function() {
          return _this._sendBundle(bundle);
        }), timeout);
      }
    };

    Hub.prototype.send = function(message) {
      var node, nodes, _i, _len, _results;
      console.log("received", message instanceof osc.Bundle);
      if (message instanceof osc.Bundle) {
        return this._sendBundle(message);
      } else if (message instanceof osc.Message) {
        if (address.isValidPattern(message.address)) {
          nodes = this.getNodesByPattern(message.address);
          if (nodes) {
            _results = [];
            for (_i = 0, _len = nodes.length; _i < _len; _i++) {
              node = nodes[_i];
              node.emit("message", message);
              _results.push(node);
            }
            return _results;
          }
        } else {
          node = this.getNodeByAddress(message.address);
          if (node) {
            node.emit("message", message);
          }
          return node;
        }
      }
    };

    return Hub;

  })(Tree);

  Session = (function(_super) {

    __extends(Session, _super);

    function Session(hub, data) {
      if (data == null) {
        data = {};
      }
      this.onDisposeNode = __bind(this.onDisposeNode, this);

      this.hub = hub;
      this.id = this.hub.nextId();
      this.createdAt = new Date;
      this.data = data;
      this.nodes = [];
    }

    Session.prototype.close = function() {
      var node, _i, _len, _ref;
      this.emit("close");
      this.hub.emit("session:close", this);
      _ref = this.nodes.slice(0);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        node.dispose();
      }
      return this.removeAllListeners();
    };

    Session.prototype.onDisposeNode = function(node) {
      var index;
      if (node.owner === this) {
        if ((index = this.nodes.indexOf(node)) > -1) {
          return this.nodes.splice(index, 1);
        }
      }
    };

    Session.prototype.createNode = function(address, data) {
      var node;
      node = this.hub.createNode(address);
      if (typeof data === 'object') {
        node.data = data;
      }
      node.owner = this;
      this.nodes.push(node);
      node.on("dispose", this.onDisposeNode);
      this.emit("node", node);
      return node;
    };

    return Session;

  })(EventEmitter);

  Hub.Session = Session;

  module.exports = Hub;

}).call(this);

});

require.define("/src/a2r-hub/a2r_web/index.js",function(require,module,exports,__dirname,__filename,process,global){var Hub = require("../hub");
var osc = Hub.osc;
var WebSocket = (global.WebSocket || global.MozWebSocket);

var ws = new WebSocket("ws://192.168.1.100:8080");

ws.binaryType = "arraybuffer"

ws.onopen = function() {
  console.log("We are ready")
};

ws.onmessage = function(msg) {
  console.log("Whats up?");
  console.log(osc.fromBuffer(msg.data));
};

});
require("/src/a2r-hub/a2r_web/index.js");
})();
