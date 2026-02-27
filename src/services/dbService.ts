
const DB_NAME = 'GeminiAdventureDB';
const DB_VERSION = 2; // Increment version to trigger upgrade
const STORE_NAME = 'worlds';
const GALLERY_STORE = 'gallery';

interface IDBRequestEvent extends Event {
    target: IDBRequest;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("Database error");
        };

        request.onsuccess = (event) => {
            resolve((event as unknown as IDBRequestEvent).target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event as unknown as IDBRequestEvent).target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(GALLERY_STORE)) {
                db.createObjectStore(GALLERY_STORE, { keyPath: 'id' });
            }
        };
    });
};

export const dbService = {
    getAll: async <T>(): Promise<T[]> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    get: async <T>(id: string): Promise<T | undefined> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    put: async <T>(data: T): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    delete: async (id: string): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    // --- GALLERY METHODS (Dedicated Store) ---
    
    getGalleryMetadata: async <T>(worldId: string): Promise<T[]> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([GALLERY_STORE], 'readonly');
            const store = transaction.objectStore(GALLERY_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                const all = request.result || [];
                // Return entries WITHOUT the bulky imageUrl to save RAM
                const filtered = all
                    .filter((item: any) => item.worldId === worldId)
                    .map(({ imageUrl, ...metadata }: any) => metadata);
                resolve(filtered);
            };
            request.onerror = () => reject(request.error);
        });
    },

    getGalleryImage: async (id: string): Promise<string | undefined> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([GALLERY_STORE], 'readonly');
            const store = transaction.objectStore(GALLERY_STORE);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result?.imageUrl);
            request.onerror = () => reject(request.error);
        });
    },

    putGalleryEntry: async <T>(entry: T): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([GALLERY_STORE], 'readwrite');
            const store = transaction.objectStore(GALLERY_STORE);
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    deleteGalleryEntry: async (id: string): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([GALLERY_STORE], 'readwrite');
            const store = transaction.objectStore(GALLERY_STORE);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Batch put for migration
    putAll: async <T>(items: T[]): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            items.forEach(item => store.put(item));
        });
    }
};
