"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoQueue = exports.Queue = void 0;
class Queue {
    _items = [];
    enqueue(item) {
        this._items.push(item);
    }
    dequeue() {
        return this._items.shift();
    }
    get size() {
        return this._items.length;
    }
}
exports.Queue = Queue;
class AutoQueue extends Queue {
    _pendingPromise = false;
    enqueue(action) {
        return new Promise((resolve, reject) => {
            super.enqueue({ action, resolve, reject });
            this.dequeue();
        });
    }
    async dequeue() {
        if (this._pendingPromise)
            return false;
        const item = super.dequeue();
        if (!item)
            return false;
        try {
            this._pendingPromise = true;
            const payload = await item.action(this);
            this._pendingPromise = false;
            item.resolve(payload);
        }
        catch (e) {
            this._pendingPromise = false;
            item.reject(e);
        }
        finally {
            void this.dequeue();
        }
        return true;
    }
}
exports.AutoQueue = AutoQueue;
//# sourceMappingURL=queue.js.map