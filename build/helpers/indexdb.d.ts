export default class IndexedDB {
    dbName: string;
    storeName: string;
    version: number;
    constructor(dbName: string, storeName: string);
    getDb(): Promise<IDBDatabase>;
    getItem<T>(key: string | number): Promise<T | null>;
    setItem(key: string | number, value: any): Promise<void>;
    removeItem(key: string | number): Promise<void>;
    keys(): Promise<unknown>;
    count(): Promise<unknown>;
    length(): Promise<unknown>;
    clear(): Promise<void>;
}
