"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventEmitter = void 0;
/**
 * Generic event emitter class for handling typed events and their callbacks
 * @template T Record type containing event names as keys and their payload types as values
 */
class EventEmitter {
    /** Internal storage for event callbacks */
    events = {};
    /**
     * Subscribe to an event
     * @template K Event name type
     * @param event Name of the event to subscribe to
     * @param callback Function to be called when event is emitted
     */
    on(event, callback) {
        if (!this.events[event])
            this.events[event] = [];
        this.events[event].push(callback);
    }
    /**
     * Emit an event with payload
     * @template K Event name type
     * @param event Name of the event to emit
     * @param payload Data to pass to event handlers
     */
    emit(event, payload) {
        this.events[event]?.forEach((cb) => cb(payload));
    }
    /**
     * Unsubscribe from an event
     * @template K Event name type
     * @param event Name of the event to unsubscribe from
     * @param callback Function to remove from event handlers
     */
    off(event, callback) {
        this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
    }
    /**
     * Subscribe to an event for a single emission
     * @template K Event name type
     * @param event Name of the event to subscribe to
     * @param callback Function to be called when event is emitted
     */
    once(event, callback) {
        const onceWrapper = (payload) => {
            callback(payload);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }
    /**
     * Remove all event listeners
     * @template K Event name type
     * @param event Optional event name to remove listeners for. If not provided, removes all listeners for all events
     */
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        }
        else {
            this.events = {};
        }
    }
}
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=events.js.map