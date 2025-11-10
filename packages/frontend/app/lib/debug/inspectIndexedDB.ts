/**
 * IndexedDB Inspector
 *
 * Utility to inspect IndexedDB contents and identify persisted accounts
 * that might be causing the 12+ account registration issue.
 *
 * Related issue: packages/docs/research/errors/pxe-tags-limit-error.md
 */

/**
 * Inspect PXE IndexedDB to see stored accounts
 *
 * @param dbName - Name of IndexedDB database (default: 'pxe_data')
 * @returns Promise that resolves when inspection is complete
 *
 * @example
 * ```typescript
 * await inspectPXEIndexedDB();
 * // Output in console:
 * // 📦 IndexedDB Database: pxe_data
 * // 📂 Object stores: ['accounts', 'notes', 'contracts']
 * // 📁 Store "accounts": 12 items
 * ```
 */
export async function inspectPXEIndexedDB(
  dbName: string = 'pxe_data'
): Promise<void> {
  return new Promise((resolve) => {
    console.group('📦 [INDEXED DB INSPECTOR]');
    console.log(`Database: ${dbName}`);

    try {
      const request = indexedDB.open(dbName);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const storeNames = Array.from(db.objectStoreNames);

        console.log(`📂 Object stores (${storeNames.length}):`, storeNames);
        console.log('');

        if (storeNames.length === 0) {
          console.log('✅ Database is empty (no stores)');
          console.groupEnd();
          resolve();
          return;
        }

        // Inspect each store
        const tx = db.transaction(storeNames, 'readonly');
        let completedStores = 0;

        storeNames.forEach((storeName) => {
          try {
            const store = tx.objectStore(storeName);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
              const count = countRequest.result;

              if (count > 0) {
                console.group(`📁 Store: "${storeName}"`);
                console.log(`Items: ${count}`);

                // Try to get first few items for preview
                const getAllRequest = store.getAll(undefined, 3);

                getAllRequest.onsuccess = () => {
                  const items = getAllRequest.result;
                  if (items.length > 0) {
                    console.log('Sample items:');
                    items.forEach((item, i) => {
                      console.log(`  ${i + 1}.`, item);
                    });
                  }
                  console.groupEnd();
                };

                getAllRequest.onerror = () => {
                  console.log('(Could not read items)');
                  console.groupEnd();
                };
              } else {
                console.log(`📁 Store "${storeName}": empty`);
              }

              completedStores++;
              if (completedStores === storeNames.length) {
                console.log('');
                console.log('✅ Inspection complete');
                console.groupEnd();
                resolve();
              }
            };

            countRequest.onerror = () => {
              console.warn(`⚠️ Could not count items in "${storeName}"`);
              completedStores++;
              if (completedStores === storeNames.length) {
                console.groupEnd();
                resolve();
              }
            };
          } catch (error) {
            console.error(`Error inspecting store "${storeName}":`, error);
            completedStores++;
            if (completedStores === storeNames.length) {
              console.groupEnd();
              resolve();
            }
          }
        });

        tx.oncomplete = () => {
          db.close();
        };

        tx.onerror = () => {
          console.error('Transaction error');
          console.groupEnd();
          resolve();
        };
      };

      request.onerror = () => {
        console.warn(`⚠️ Could not open IndexedDB "${dbName}"`);
        console.log('(Database might not exist yet)');
        console.groupEnd();
        resolve();
      };

      request.onblocked = () => {
        console.warn('⚠️ Database open request blocked');
        console.groupEnd();
        resolve();
      };
    } catch (error) {
      console.error('Failed to inspect IndexedDB:', error);
      console.groupEnd();
      resolve();
    }
  });
}

/**
 * Clean (delete) PXE IndexedDB
 *
 * @param dbName - Name of IndexedDB database to delete
 * @returns Promise that resolves when deletion is complete
 *
 * @example
 * ```typescript
 * await cleanPXEIndexedDB();
 * // Output: 🧹 Cleaning IndexedDB: pxe_data
 * //         ✅ IndexedDB cleaned successfully
 * ```
 */
export async function cleanPXEIndexedDB(
  dbName: string = 'pxe_data'
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🧹 [INDEXED DB] Cleaning database: ${dbName}`);

    try {
      const request = indexedDB.deleteDatabase(dbName);

      request.onsuccess = () => {
        console.log(`✅ [INDEXED DB] Database "${dbName}" deleted successfully`);
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED DB] Failed to delete database "${dbName}"`);
        reject(new Error('Failed to delete database'));
      };

      request.onblocked = () => {
        console.warn(`⚠️ [INDEXED DB] Database deletion blocked (close all tabs)`);
        reject(new Error('Database deletion blocked'));
      };
    } catch (error) {
      console.error('Failed to clean IndexedDB:', error);
      reject(error);
    }
  });
}

/**
 * List all IndexedDB databases
 *
 * @returns Promise that resolves with array of database names
 */
export async function listIndexedDBDatabases(): Promise<string[]> {
  try {
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      const names = databases
        .map((db) => db.name)
        .filter((name): name is string => name !== undefined);

      console.log('📚 [INDEXED DB] All databases:', names);
      return names;
    } else {
      console.warn('⚠️ indexedDB.databases() not supported in this browser');
      return [];
    }
  } catch (error) {
    console.error('Failed to list databases:', error);
    return [];
  }
}
