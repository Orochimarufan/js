// Form generation library
// (c) 2016 Taeyeon Mori
// Requires tmisc, ndevent

window.formspec = (function formspec(window, document, undefined) {

	var FieldTypeRegistry = tmisc.extend(null,
		function FieldTypeRegistry() {
			this._types = {};
		},
		{
			create: function FieldTypeRegistry_create(parent, spec) {
				if (spec.type)
					if (this._types.hasOwnProperty(spec.type)) {
						var type = this._types[spec.type];
						return new type(parent, spec);
					}
					else
						console.error("Unknown Field type: '" + spec.type + "'");
				else
					console.error("Field definition missing type: '" + spec.toString() + "'");
			},
			register: function FieldTypeRegistry_register(name, type) {
				if (this._types.hasOwnProperty(name))
					throw "Field type '" + name + "' already registered";
				this._types[name] = type;
			},
			registerIFC: function FieldTypeRegistry_registerIFC(name, options, constructor) {
				this.register(name, makeInputFieldClass(options, constructor));
				this._types[name].displayName = "InputFieldClass:" + name;
			},
		},
		{
			registry: {
				get: function () {
					return this._types;
				},
			}
		}
	);

	var field_types = new FieldTypeRegistry();

	// Abstract Field
	var Field = tmisc.extend(ndevent.EventTarget,
		function Field(parent, spec) {
			tmisc.super(Field, this, "constructor")();

			tmisc.gDefineReadOnly(this, "parent", parent);
			tmisc.gDefineReadOnly(this, "form", parent? parent.form : this);
			tmisc.gDefineReadOnly(this, "spec", spec);

			// Style applies to all descendant elements.
			tmisc.gDefineReadOnly(this, "style", parent? Object.create(parent.style) : {});
			Object.assign(this.style, spec.style);
		},
		{
			on_change: function Field_on_change() {
				this.dispatchEvent("change");
			},
			disable: function Field_disable(disable) {
				throw "Not Implemented";
			},
			get: function Field_get() {
				throw "Not Implemented";
			},
			set: function Field_set(value) {
				throw "Not Implemented";
			},
		},
		{
			value: {
				get: function () {return this.get();},
				set: function (value) {return this.set(value);},
			},
		}
	);

	// Collections of Fields
	var FieldCollection = tmisc.extend(Field,
		// Abstract Base Class for collections of fields
		function FieldCollection(parent, spec) {
			tmisc.super(FieldCollection, this, "constructor")(parent, spec);

			tmisc.gDefineReadOnly(this, "fields", []);
			tmisc.gDefineReadOnly(this, "field_map", {});
		},
		{
			field_type_registry: field_types,
			initialize_fields: function FieldCollection_initialize_fields(fields) {
				var self = this;
				fields.forEach(function (fspec) {
					var field = self.field_type_registry.create(self, fspec);
					self.add_field(field);
					self.fields.push(field);
					if (fspec.hasOwnProperty("name"))
						self.field_map[fspec.name] = field;
					field.addEventListener("change", tmisc.bind(self.on_change, self));
				});
			},
			add_field: function FieldCollection_add_field(field) {
				throw "Not Implemented";
			},
			get: function FieldCollection_get() {
				var result = {};
				for (var name in this.field_map) {
					result[name] = this.field_map[name].get();
				}
				return result;
			},
			set: function FieldCollection_set(value) {
				for (var name in value) {
					if (this.field_map.hasOwnProperty(name))
						this.field_map[name].set(value[name]);
				}
			},
			disable: function FeldCollection_disable(disabled) {
				this.fields.forEach(function (f) {f.disable(disabled);});
			},
		}
	);

	var FieldContainer = tmisc.extend(FieldCollection,
		function FieldContainer(parent, spec) {
			tmisc.super(FieldContainer, this, "constructor")(parent, spec);

			this.dom = this.create_dom();

			if (!this._keep_fields && spec.fields)
				this.initialize_fields(spec.fields);
		},
		{
			create_dom: function FieldContainer_create_dom() {
				return tmisc.newElement(this.spec.container_element ? this.spec.container_element : "div", {class: "fs-field-container"});
			},
			add_field: function FieldContainer_add_field(field) {
				this.dom.appendChild(field.dom);
			},
		}
	);

	var Form = tmisc.extend(FieldContainer,
		function Form(parent, spec) {
			if (!spec) {
				spec = parent;
				parent = null;
			}

			tmisc.super(Form, this, "constructor")(parent, spec);

			if (this.style.form_style)
				if (this.form_styles.hasOwnProperty(this.style.form_style))
					this.form_style = this.form_styles[this.style.form_style];
				else
					console.warn("Unknown form style: '" + this.style.form_style + "'");

			if (this.form_style && this.form_style.apply)
				this.form_style.apply(this);
		},
		{
			form_styles: {
				"uk-form-horizontal": {
					apply: function (form) {
						tmisc.addClass(form.dom, "uk-form uk-form-horizontal");
					}
				},
				"uk-form": {
					apply: function (form) {
						tmisc.addClass(form.dom, "uk-form");
					}
				},
			},
			create_dom: function Form_create_dom() {
				return tmisc.newElement("form", {class: "fs-form"});
			},
		}
	);

	// Wrappers
	var FieldWrapper = tmisc.extend(Field,
		function FieldWrapper(parent, spec, inner) {
			tmisc.super(FieldWrapper, this, "constructor")(parent, spec);

			if (inner)
				this.install_field(inner);
			else if (!this._keep_field && spec.field)
				this.initialize_field(spec.field);

			if (this.field)
				this.dom = this.field.dom;
		},
		{
			field_type_registry: field_types,
			initialize_field: function FieldWrapper_initialize_field(fspec) {
				fspec.name = this.spec.name;
				var field = this.field_type_registry.create(this, fspec);
				this.install_field(field);
				return field;
			},
			install_field: function FieldWrapper_install_field(field) {
				this.field = field;
				field.addEventListener("change", tmisc.bind(this.on_change, this));
			},
			get: function FieldWrapper_get() {
				return this.field.get();
			},
			set: function FieldWrapper_set(value) {
				return this.field.set(value);
			},
			disable: function FieldWrapper_disable(disabled) {
				return this.field.disable(disabled);
			},
		}
	);

	var LabeledField = tmisc.extend(FieldWrapper,
		function LabeledField(parent, spec, inner) {
			tmisc.super(LabeledField, this, "constructor")(parent, spec, inner);

			this.label = tmisc.newElement("label", null, [
				tmisc.textNode(spec.label)]);

			this.form_style = null;
			if (this.style.form_style)
				if (this.form_styles.hasOwnProperty(this.style.form_style))
					this.form_style = this.form_styles[this.style.form_style];
				else
					console.warn("Form style '" + this.style.form_style + "' not supported by LabeledField");

			if (!this.form_style || !this.form_style.apply)
				this.form_style = this.form_styles.default;

			this.dom = this.form_style.apply(this);
		},
		{
			form_styles: {
				"uk-form-horizontal": {
					apply: function(f) {
						tmisc.addClass(f.label, "uk-form-label");
						var div = tmisc.newElement("div", {class: "uk-form-row"}, [
							f.label,
							tmisc.newElement("div", {class: "uk-form-controls"}, [
								f.field.dom])]);
						return div;
					},
				},
				default: {
					apply: function(f) {
						var div = document.createElement("div");
						if (!f.spec.postfix_label)
							div.appendChild(f.label);
						div.appendChild(f.field.dom);
						if (f.spec.postfix_label) {
							div.appendChild(f.label);
							tmisc.addClass(div, "fs-gic-postfix-label");
						}
						return div;
					},
				},
			},
		}
	);

	// Input Fields
	var GenericInputClass = tmisc.extend(Field,
		function GenericInputClass(parent, spec) {
			tmisc.super(GenericInputClass, this, "constructor")(parent, spec);

			// Apply class defaults
			for (key in this.defaults)
				if (this.defaults.hasOwnProperty(key) && !spec.hasOwnProperty(key))
					spec[key] = this.defaults[key];

			// Create DOM
			this.input = this.dom = document.createElement("input");
			this.input.name = spec.name;
			if (spec.input_type)
				this.input.type = spec.input_type;
			this.input.addEventListener("change", tmisc.bind(this.on_change, this));

			// Allow easy wrapping in a LabeledField
			if (spec.label) {
				return new LabeledField(parent, spec, this);
			}
		},
		{
			defaults: {},
			get: function GenericInputClass_get() {
				if (this.get_filter)
					return this.get_filter(this.input.value);
				else
					return this.input.value;
			},
			set: function GenericInputClass_set(value) {
				return (this.input.value = value);
			},
			disable: function GenericInputClass_disable(disabled) {
				return (this.input.disabled = disabled);
			}
		}
	);

	function makeInputFieldClass(options, input_constructor) {
		if (input_constructor) {
			function InputField(parent, spec) {
				var v = tmisc.super(InputField, this, "constructor")(parent, spec);
				input_constructor(this);
				return v;
			}
		}
		else
			InputField = null;
		return tmisc.extend(GenericInputClass,
			InputField,
			options
		);
	};

	// ----------------------------------------------------
	// Builtin Field Types
	// ----------------------------------------------------

	// Inputs
	field_types.registry.input = GenericInputClass;

	field_types.registerIFC("textbox", {
		defaults: {
			input_type: "text",
		},
	});

	field_types.registerIFC("checkbox", {
		defaults: {
			input_type: "checkbox",
			postfix_label: true,
		},
		get: function checkbox_get() {
			return this.input.checked;
		},
		set: function checkbox_set(value) {
			return (this.input.checked = value);
		},
	});

	field_types.registerIFC("number", null,
		function number(field) {
			field.input.type = "number";
			if (field.min)
				field.input.min = field.min;
			if (field.max)
				field.input.max = field.max;
			if (field.step)
				field.input.step = field.step;
		},
		{
			get_filter: parseFloat,
		}
	);

	// Wrappers
	field_types.registry.checked = tmisc.extend(FieldWrapper,
		function CheckedField(parent, spec) {
			tmisc.super(CheckedField, this, "constructor")(parent, spec);

			this.check = tmisc.newElement("input", {type: "checkbox"});
			this.dom = tmisc.newElement("div", {class: "fs-checked-field"}, [this.check]);

			this.check.addEventListener("change", tmisc.bind(this.on_check_change, this));

			this.initialize_field(spec.field);

			this.dom.appendChild(this.field.dom);

			this.field.disable(!this.check.checked);
		},
		{
			_keep_field: true,
			on_check_change: function CheckedField_on_check_change() {
				this.field.disable(!this.check.checked);
				this.on_change();
			},
			get: function CheckedField_get() {
				return this.check.checked? this.field.get() : null;
			},
			set: function CheckedField_set(value) {
				if (value === null || value === undefined)
					this.check.checked = false;
				else {
					this.check.checked = true;
					this.field.set(value);
				}
			},
			disable: function CheckedField_disable(disabled) {
				if (disabled) {
					this.check.disabled = true;
					this.field.disable(true);
				} else {
					this.check.disabled = false;
					this.field.disable(!this.check.checked);
				}
			},
		}
	);

	field_types.registry.labeled = LabeledField;

	// Containers etc
	field_types.registry.form = Form;

	field_types.registry.container = FieldContainer;

	field_types.registry.fieldset = tmisc.extend(FieldContainer,
		function FieldSet(parent, spec) {
			tmisc.super(FieldSet, this, "constructor")(parent, spec);

			this.dom.appendChild(tmisc.newElement("legend", null, [tmisc.textNode(spec.legend)]));
		}
	);

	var MultipleChoice =  // needed for super() call
	field_types.registry.multiple_choice = tmisc.extend(FieldContainer,
		function MultipleChoice(parent, spec) {
			tmisc.super(MultipleChoice, this, "constructor")(parent, spec);

			if (!this.style.hasOwnProperty("form_style"))
				this.style.form_style = null; // Open new style context.

			var fields = [];
			spec.choices.forEach(function (cspec) {
				fields.push({
					type: "checkbox",
					name: cspec.name,
					default: cspec.default,
					label: cspec.label,
				});
			});

			if (spec.others_choice) {
				fields.push({
					type: "labeled",
					name: spec.others_choice.name,
					type: "checked",
					field: {
						type: "textbox",
					}
				});
			}

			this.initialize_fields(fields);
		},
		{
			get_list: function MultipleChoice_get_list() {
				return this.fields.map(function (f) {
					var value = f.get();
					if (typeof value === 'boolean')
						return value? f.spec.name : null;
					else
						return value;
				}).filter(function (v) {return v !== null;});
			},
			get: function MultipleChoice_get() {
				if (this.spec.as_list)
					return this.get_list();
				else
					return tmisc.super(MultipleChoice, this, "get")();
			},
			set: function MultipleChoice_set(value) {
				if (value instanceof Array) {
					var self = this;
					this.fields.forEach(function (f) {
						if (f.spec.type === 'checkbox')
							f.value = value.indexOf(f.spec.name) !== -1;
						else {
							var vals = [];
							value.forEach(function (v) {
								if (!self.field_map.hasOwnProperty(v))
									vals.push(v);
							});
							f.value = vals? vals.join(", ") : null;
						}
					});
				}
				else
					return tmisc.super(MultipleChoice, this, "set")(value);
			}
		}
	);

	return {
		Field: Field,
		FieldWrapper: FieldWrapper,
		LabeledField: LabeledField,
		FieldCollection: FieldCollection,
		FieldContainer: FieldContainer,
		Form: Form,
		GenericInputClass: GenericInputClass,
		GenericInputField: GenericInputClass,
		makeInputFieldClass: makeInputFieldClass,
		TYPES: field_types,
	};
})(window, document);
