// Simple Non-DOM Event Library
// (c) 2016 Taeyeon Mori
// All rights reserved
// This tries to mimic the DOM Lv2 event API
// Inherit from ndevent.EventTarget to use.

window.ndevent = (function (window, undefined) {
    var ndevent = {
        Event: (function () {
            function Event(event_name, detail) {
                Object.assign(this, detail);
                Object.defineProperty(this, "type", {writable: false, value: event_name, configurable: false});
                this.target = undefined;
            }

            return Event;
        })(),

        EventTarget: (function() {
            function EventTarget() {
                this.__EventTarget = {
                    callbacks: {}
                };
            }

            EventTarget.prototype = {
                constructor: EventTarget,
                addEventListener: function addEventListener(event_name, callback) {
                    var callbacks = this.__EventTarget.callbacks;
                    if (!callbacks.hasOwnProperty(event_name))
                        callbacks[event_name] = [];
                    callbacks[event_name].push(callback);
                    return true;
                },
                removeEventListener: function removeEventListener(event_name, callback) {
                    var callbacks = this.__EventTarget.callbacks;
                    if (callbacks.hasOwnProperty(event_name))
                        callbacks[event_name].remove(callback);
                    return true;
                },
                dispatchEvent: function dispatchEvent(event, detail) {
                    var callbacks = this.__EventTarget.callbacks;

                    if (typeof event == "string") {
                        if (callbacks.hasOwnProperty(event))
                            event = new ndevent.Event(event, detail);
                        else
                            return;
                    }
                    else if (!callbacks.hasOwnProperty(event.type))
                        return;

                    event.target = this;
                    callbacks[event.type].forEach(function (cb) {
                        cb.call(this, event);
                    });
                },
            };

            return EventTarget;
        })(),
    };

    return ndevent;
})();