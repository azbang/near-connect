export declare class Queue {
    _items: any[];
    enqueue(item: any): void;
    dequeue(): any;
    get size(): number;
}
export declare class AutoQueue extends Queue {
    _pendingPromise: boolean;
    enqueue<T>(action: () => Promise<T>): Promise<T>;
    dequeue(): Promise<boolean>;
}
