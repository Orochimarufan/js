// JS Settings Library
// (c) 2016 Taeyeon Mori
// All rights reserved
// Requires ndevent.js
// WIP

window.tmset = (function(window, undefined) {
    function curry(uncurried) {
        var parameters = Array.prototype.slice.call(arguments, 1);
        return function() {
            return uncurried.apply(this, parameters.concat(
                Array.prototype.slice.call(arguments, 0)
            ));
        };
    }

    function gDefineReadOnly(object, name, value) {
        Object.defineProperty(object, name, {
            value: value,
            writable: false,
            enumerable: true,
            configurable: false,
        });
    }

    var tmset = {
    // Settings Class
    // Reserved: save, load, getItem, setItem, resetItem, forEach, addEventListener, removeEventListener, any underscore names
        Settings: (function(){
            function subkey_get_proxy(setting, ospec, value) {
                var subkey = typeof ospec.subkey == "function" ? ospec.subkey() : ospec.subkey;
                if (typeof value == "object" && value.hasOwnProperty(subkey))
                    return value[subkey];
                else
                    return ospec.default;
            }
            function subkey_set_proxy(setting, ospec, value, current, raw_set) {
                var subkey = typeof ospec.subkey == "function" ? ospec.subkey() : ospec.subkey;
                if (typeof current != typeof {})
                    current = {};
                current[subkey] = value;
                return raw_set(current);
            }

            function Settings(spec, extra) {
                ndevent.EventTarget.call(this);

                this._settings = {};
                this._spec = spec;

                // Properties
                this.forEach(function (setting, ospec) {
                    // Initialize Spec
                    if (ospec.subkey)
                    {
                        ospec.get_proxy = subkey_get_proxy;
                        ospec.set_proxy = subkey_set_proxy;
                    }
                    // Add as property
                    if (this.hasOwnProperty(setting))
                        return; // Don't overwrite methods
                    Object.defineProperty(this, setting, {
                        enumerable: true,
                        configurable: false,
                        get: ospec.get_proxy ? function () {
                            return ospec.get_proxy.call(this, setting, ospec, this._settings[setting]);
                        } : function() {
                            if (this._settings.hasOwnProperty(setting))
                                return this._settings[setting];
                            else
                                return ospec.default;
                        },
                        set: ospec.set_proxy ? function(value) {
                            return ospec.set_proxy(this, setting, ospec, value, settings[setting], curry(this.__Settings_raw_set, setting));
                        } : this.__Settings_raw_set});
                });
            }

            Settings.prototype = Object.assign(Object.create(ndevent.EventTarget.prototype), {
                __Settings_changed: function changed(setting, old_value, new_value) {
                    this.dispatchEvent("change", {setting: setting, old_value: old_value, value: new_value});
                    this.dispatchEvent(setting + "_change", {setting: setting, old_value: old_value, value: new_value});
                },

                getItem: function getItem(setting) {
                    var ospec = this._spec[setting];
                    if (this._settings.hasOwnProperty(setting))
                    {
                        var value = this._settings[setting];
                        if (ospec.get_proxy)
                            return ospec.get_proxy.call(this, setting, ospec, value);
                        else
                            return value;
                    }
                    return ospec.default;
                },

                __Settings_raw_set: function raw_set(setting, value) {
                    var old = this._settings[setting];
                    this._settings[setting] = value;
                    this.__Settings_changed(setting, old, value);
                    return true;
                },

                setItem: function setItem(setting, value) {
                    var ospec = this._spec[setting];
                    var old = this.getItem(setting);
                    if (ospec.set_proxy)
                        return ospec.set_proxy.call(this, setting, ospec, value, this._settings[setting], curry(this.__Settings_raw_set, setting));
                    else
                        return this.__Settings_raw_set(setting, value);
                },

                resetItem: function resetItem(setting) {
                    var ospec = this._spec[setting];
                    var old = this.getItem(setting);
                    if (ospec.subkey) // XXX Bad
                        delete this._settings[setting][ospec.subkey];
                    else if (ospec.set_proxy)
                        ospec.set_proxy.call(this, setting, ospec, undefined, this._settings[setting], curry(this.__Settings_raw_set, setting));
                    else
                        delete this._settings[setting];
                    this.__Settings_changed(setting, old, ospec.default);
                    return true;
                },

                forEach: function forEach(f) {
                    var spec = this._spec;

                    for (var setting in spec) {
                        if (spec.hasOwnProperty(setting))
                            f.call(this, setting, spec[setting]);
                    }
                },

                load: function load(storage_key, storage) {
                    if (storage === undefined)
                        storage = localStorage;
                    var src = storage.getItem(storage_key);
                    if (src)
                        this._settings = JSON.parse(src);
                    else
                        return false;
                    this.forEach(function (setting, ospec) {
                        this.__Settings_changed(setting, undefined, this.getItem(setting));
                    });
                    return true;
                },

                save: function save(storage_key, storage) {
                    if (storage === undefined)
                        storage = localStorage;
                    return storage.setItem(storage_key, JSON.stringify(this._settings));
                },
            });

            return Settings;
        })(),

        GenericInputUIClass: function GenericInputUIClass(make_input, input_value, update_input) {
            this.create = function (settings, setting, spec) {
                var option = document.createElement("div");
                var input = document.createElement("input");
                make_input(input, setting, spec);
                option.appendChild(input);
                var label = document.createElement("label");
                label.appendChild(document.createTextNode(spec.label));
                option.appendChild(label);
                input.addEventListener("change", function (e) {
                    settings.setItem(setting, input_value(input));
                });
                update_input(input, settings.getItem(setting));
                return option;
            };

            this.disable = function (option, disabled) {
                option.firstChild.disabled = disabled;
            };

            this.update = function (option, value) {
                update_input(option.firstChild, value);
            };
        },

        ui_classes: {},

        SettingsUI: (function(){

            function SettingsUI(settings, extra) {
                // Create UI
                var ui = document.createElement("form");
                ui.className = "settings settings_form";
                var options = {};
                var groups = {};

                var listen_for = {};
                var listen_any = [];

                settings.forEach(function (setting, ospec) {
                    var option = null;

                    if (ospec.hasOwnProperty("ui")) {
                        var ui_spec = ospec.ui;

                        if (tmset.ui_classes.hasOwnProperty(ui_spec.type)) {
                            var ui_class = tmset.ui_classes[ui_spec.type];

                            option = ui_class.create(settings, setting, ui_spec, ospec);

                            if (option) {
                                options[setting] = option;
                                option.className += "settings settings_option settings_class_" + ui_spec.type;
                                option.id = "settings_option_" + setting;

                                if (ui_class.update)
                                    listen_for[setting] = curry(ui_class.update, option);

                                if (ui_spec.tooltip)
                                    option.title = ui_spec.tooltip;

                                if (ui_spec.disabled)
                                    ui_class.disable(option, true);
                                else if (ui_spec.enable_if) {
                                    ui_class.disable(option, !ui_spec.enable_if(settings));
                                    listen_any.push(function (setting, value) {
                                        ui_class.disable(option, !ui_spec.enable_if(settings));
                                    });
                                }

                                if (ui_spec.group) {
                                    if (!groups.hasOwnProperty(ui_spec.group)) {
                                        var group = document.createElement("fieldset");
                                        group.style = "margin-bottom: 5px; padding-top: 0px;";
                                        var legend = document.createElement("legend");
                                        legend.innerHTML = ui_spec.group;
                                        group.appendChild(legend);
                                        ui.appendChild(group);
                                        groups[ui_spec.group] = group;
                                    }
                                    groups[ui_spec.group].appendChild(option);
                                } else
                                    ui.appendChild(option);
                            }
                        }
                    }
                });

                // Change notifications
                function onChange(e) {
                    var setting = e.setting;
                    var value = e.value;
                    if (listen_for.hasOwnProperty(setting))
                        listen_for[setting](value);

                    listen_any.forEach(function (cb) {
                        cb(setting, value);
                    });
                }

                settings.addEventListener("change", onChange);

                var definero = curry(gDefineReadOnly, this);

                definero("settings", settings);
                definero("destroy", function destroy() {
                    settings.removeEventListener("change", onChange);
                });

                definero("dom", ui);
                definero("options", options);
                definero("groups", groups);
            };

            return SettingsUI;
        })(),
    };

    tmset.ui_classes["checkbox"] = new tmset.GenericInputUIClass(
        function (input, setting, spec) {
            input.type = "checkbox";
        },
        function (input) { return input.checked; },
        function (input, value) { input.checked = value; });
    tmset.ui_classes["range"] = new tmset.GenericInputUIClass(
        function (input, setting, spec) { // XXX
            input.type = "range";
            input.min = spec.min;
            input.max = spec.max;
        },
        function (input) { return input.value; },
        function (input, value) { input.value = value; });

    return tmset;
})(window);