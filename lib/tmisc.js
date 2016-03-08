// JS Misc utilities library
// (c) 2016 Taeyeon Mori

window.tmisc = (function(window, document, undefined) {
	var tmisc = {
		// --------------------------------------
		// Generic Helpers
		// --------------------------------------
		/// Curry a function (bind the first N arguments)
		curry: function curry(uncurried) {
			var parameters = Array.prototype.slice.call(arguments, 1);
			return function() {
				return uncurried.apply(this, parameters.concat(
					Array.prototype.slice.call(arguments, 0)
				));
			};
		},

		/// Define a read-only property on some object
		gDefineReadOnly: function gDefineReadOnly(object, name, value) {
			Object.defineProperty(object, name, {
				value: value,
				writable: false,
				enumerable: true,
				configurable: false,
			});
		},

		/// Define a read-only property on some object, freezing the value
		gDefineFrozen: function gDefineFrozen(object, name, value) {
			tmisc.gDefineReadOnly(object, name, Object.freeze(value));
		},

		// --------------------------------------
		// Inheritance-related
		// --------------------------------------
		/// Bind a function call to a specific this-object
		bind: function bind(fun, xthis) {
			return function _bound() {
				return fun.apply(xthis, arguments);
			};
		},

		/// Create a new class
		/// @param base The base class (optional)
		/// @param constructor The class constructor (optional)
		/// @param prototype The class prototype object (optional)
		/// @param properties Additional properties to be defined on the object. (optional)
		extend: function extend(base, constructor, prototype, properties) {
			if (base) {
				if (!constructor)
					constructor = function DefaultConstructedClass() {
						return base.apply(this, arguments);
					};
				if (prototype) {
					properties = properties || {};
					for (var prop in prototype) {
						if (properties.hasOwnProperty(prop))
							properties[prop].value = prototype[prop];
						else
							properties[prop] = {value: prototype[prop]};
					}
				}
				constructor.prototype = Object.create(base.prototype, properties);
			} else {
				if (!constructor)
					constructor = function DefaultConstructedClass() {};
				if (prototype) {
					if (properties)
						constructor.prototype = Object.defineProperties(prototype, properties);
					else
						constructor.prototype = prototype;
				}
				else if (properties)
					constructor.prototype = Object.defineProperties({}, properties);
				else
					constructor.prototype = {};
			}

			constructor.prototype.constructor = constructor;
			constructor.prototype.base = base;

			return constructor;
		},

		/// Retrieve a base-class property
		/// @param class_ The current class (constructor) DO NOT USE this.constructor!
		/// @param self The current instance (this)
		/// @param name The property name
		/// @warn using this.constructor for class_ WILL break delegation in higher superclasses.
		super: function supper(class_, self, name) {
			var value = class_.prototype.base.prototype[name];
			if (typeof value == 'function')
				return tmisc.bind(value, self);
			return value;
		},

		// --------------------------------------
		// DOM-related
		// --------------------------------------
		/// Quickly create a new DOM Element
		newElement: function newElement(tag, attrs, children) {
			var self = document.createElement(tag);

			if (attrs)
				for (var attr in attrs)
					if (attrs.hasOwnProperty(attr) && attrs[attr] !== undefined)
						self.setAttribute(attr, attrs[attr]);

			if (children)
				children.forEach(function (child) {
					self.appendChild(child);
				});

			return self;
		},

		/// createTextNode is actually a _method_ of document (i.e. requires this==document)
		textNode: function textNode(text) {
			return document.createTextNode(text);
		},

		/// Add a class to a DOM element w/o jQuery
		addClass: function addClass(dom, classes) {
			if (dom.className)
				dom.className += " " + classes;
			else
				dom.className = classes;
			return dom.className;
		},
	};

	return tmisc;
})(window, document);
