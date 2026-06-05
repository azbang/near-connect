/**
 * Generic event emitter class for handling typed events and their callbacks
 * @template T Record type containing event names as keys and their payload types as values
 */
export declare class EventEmitter<T extends Record<string, any>> {
    /** Internal storage for event callbacks */
    private events;
    /**
     * Subscribe to an event
     * @template K Event name type
     * @param event Name of the event to subscribe to
     * @param callback Function to be called when event is emitted
     */
    on<K extends keyof T>(event: K, callback: (payload: T[K]) => void): void;
    /**
     * Emit an event with payload
     * @template K Event name type
     * @param event Name of the event to emit
     * @param payload Data to pass to event handlers
     */
    emit<K extends keyof T>(event: K, payload: T[K]): void;
    /**
     * Unsubscribe from an event
     * @template K Event name type
     * @param event Name of the event to unsubscribe from
     * @param callback Function to remove from event handlers
     */
    off<K extends keyof T>(event: K, callback: (payload: T[K]) => void): void;
    /**
     * Subscribe to an event for a single emission
     * @template K Event name type
     * @param event Name of the event to subscribe to
     * @param callback Function to be called when event is emitted
     */
    once<K extends keyof T>(event: K, callback: (payload: T[K]) => void): void;
    /**
     * Remove all event listeners
     * @template K Event name type
     * @param event Optional event name to remove listeners for. If not provided, removes all listeners for all events
     */
    removeAllListeners<K extends keyof T>(event?: K): void;
}
