"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class IndexedDB {
    dbName;
    storeName;
    version;
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = 1;
    }
    getDb() {
        return new Promise((resolve, reject) => {
            if (typeof window === "undefined" || typeof indexedDB === "undefined") {
                reject(new Error("IndexedDB is not available (SSR environment)"));
                return;
            }
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = (event) => {
                console.error("Error opening database:", event.target.error);
                reject(new Error("Error opening database"));
            };
            request.onsuccess = (event) => {
                resolve(request.result);
            };
            request.onupgradeneeded = (event) => {
                const db = request.result;
                const existingStores = db.objectStoreNames;
                if (!existingStores.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }
    async getItem(key) {
        const db = await this.getDb();
        if (typeof key === "number") {
            key = key.toString();
        }
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result);
                db.close();
            };
        });
    }
    async setItem(key, value) {
        const db = await this.getDb();
        if (typeof key === "number") {
            key = key.toString();
        }
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
        });
    }
    async removeItem(key) {
        const db = await this.getDb();
        if (typeof key === "number") {
            key = key.toString();
        }
        if (typeof key !== "string") {
            throw new Error("Key must be a string");
        }
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
        });
    }
    async keys() {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result);
                db.close();
            };
        });
    }
    async count() {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readonly");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.count();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result);
                db.close();
            };
        });
    }
    async length() {
        return this.count();
    }
    async clear() {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            if (!this.storeName) {
                reject(new Error("Store name not set"));
                return;
            }
            const transaction = db.transaction(this.storeName, "readwrite");
            transaction.onerror = (event) => reject(transaction.error);
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = (event) => reject(request.error);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
        });
    }
}
exports.default = IndexedDB;
//# sourceMappingURL=indexdb.js.map