/**
 * PXE Error Handler
 *
 * Handles IndexedDB transaction errors gracefully by providing
 * user-friendly recovery options.
 *
 * Common errors handled:
 * - TransactionInactiveError: IndexedDB transaction timeout
 * - QuotaExceededError: Storage limit reached
 * - VersionError: Database version conflicts
 */

// Simple logger wrapper
const logger = {
  info: (...args: unknown[]) => console.log('[PXE Error Handler]', ...args),
  error: (...args: unknown[]) => console.error('[PXE Error Handler]', ...args),
  warn: (...args: unknown[]) => console.warn('[PXE Error Handler]', ...args),
};

/**
 * Clean PXE IndexedDB database
 * This forces a complete resync on next page load
 *
 * @param dbName - Name of the IndexedDB database to clean
 */
export async function cleanPXEIndexedDB(dbName = 'pxe_data'): Promise<void> {
  try {
    logger.info(`[PXE Recovery] Cleaning IndexedDB: ${dbName}`);

    const databases = await indexedDB.databases();
    const pxeDatabases = databases.filter(
      db => db.name?.includes('pxe') || db.name?.includes('aztec')
    );

    for (const db of pxeDatabases) {
      if (db.name) {
        logger.info(`[PXE Recovery] Deleting database: ${db.name}`);
        indexedDB.deleteDatabase(db.name);
      }
    }

    logger.info('[PXE Recovery] IndexedDB cleaned successfully');
  } catch (error) {
    logger.error('[PXE Recovery] Failed to clean IndexedDB:', error);
    throw error;
  }
}

/**
 * Check if error is an IndexedDB transaction error
 */
export function isIndexedDBTransactionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const errorPatterns = [
    'TransactionInactiveError',
    'transaction has finished',
    'transaction is not active',
    'IDBCursor',
    'QuotaExceededError',
    'VersionError',
  ];

  return errorPatterns.some(pattern =>
    error.message?.includes(pattern) || error.name?.includes(pattern)
  );
}

/**
 * Handle PXE IndexedDB errors with user-friendly recovery
 *
 * Strategy:
 * 1. Log the error with context
 * 2. Show user notification with recovery action
 * 3. Provide automatic cleanup + reload option
 *
 * @param error - The error to handle
 * @param context - Additional context about where error occurred
 */
export async function handlePXEIndexedDBError(
  error: Error,
  context?: {
    operation?: string;
    operationId?: string;
    queueLength?: number;
  }
): Promise<void> {
  if (!isIndexedDBTransactionError(error)) {
    // Not an IndexedDB error, rethrow
    throw error;
  }

  // Log error with full context
  logger.error('[PXE Error Handler] IndexedDB transaction error detected:', {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });

  // Check if we've shown this error recently (debounce)
  const lastErrorKey = 'pxe_last_error_shown';
  const lastErrorTime = sessionStorage.getItem(lastErrorKey);
  const now = Date.now();

  if (lastErrorTime && now - parseInt(lastErrorTime) < 30000) {
    // Don't spam user with errors within 30 seconds
    logger.warn('[PXE Error Handler] Error debounced (too soon after last error)');
    return;
  }

  sessionStorage.setItem(lastErrorKey, now.toString());

  // Show user-friendly error message
  showPXERecoveryNotification(error);
}

/**
 * Show recovery notification to user
 * This is a placeholder - you can replace with your toast/notification library
 */
function showPXERecoveryNotification(error: Error): void {
  // For now, use browser confirm dialog
  // TODO: Replace with your UI toast library (e.g., sonner, react-hot-toast)

  const shouldRecover = confirm(
    `Database synchronization error detected.\n\n` +
      `Error: ${error.message}\n\n` +
      `This can happen after extended use. Click OK to refresh and clear the cache, ` +
      `or Cancel to continue (may cause further errors).`
  );

  if (shouldRecover) {
    logger.info('[PXE Recovery] User initiated recovery');
    cleanPXEIndexedDB()
      .then(() => {
        logger.info('[PXE Recovery] Reloading page...');
        window.location.reload();
      })
      .catch(err => {
        logger.error('[PXE Recovery] Failed to clean database:', err);
        alert('Failed to clean database. Please refresh the page manually.');
      });
  } else {
    logger.info('[PXE Recovery] User declined recovery');
  }
}

/**
 * Wrap an async function with automatic IndexedDB error handling
 *
 * Usage:
 * ```typescript
 * const safeOperation = withPXEErrorHandling(
 *   async () => await pxe.someOperation(),
 *   { operation: 'someOperation' }
 * );
 * ```
 */
export function withPXEErrorHandling<T>(
  fn: () => Promise<T>,
  context?: {
    operation?: string;
    operationId?: string;
    queueLength?: number;
  }
): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error && isIndexedDBTransactionError(error)) {
        await handlePXEIndexedDBError(error, context);
      }
      throw error;
    }
  };
}

/**
 * Inspect PXE IndexedDB to see stored accounts
 *
 * @param dbName - Name of IndexedDB database (default: 'pxe_data')
 * @returns Promise that resolves when inspection is complete
 */
export async function inspectPXEIndexedDB(
  dbName: string = 'pxe_data'
): Promise<void> {
  return new Promise((resolve) => {
    logger.info(`[IndexedDB Inspector] Database: ${dbName}`);

    try {
      const request = indexedDB.open(dbName);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const storeNames = Array.from(db.objectStoreNames);

        logger.info(`[IndexedDB Inspector] Object stores (${storeNames.length}):`, storeNames);

        if (storeNames.length === 0) {
          logger.info('[IndexedDB Inspector] Database is empty (no stores)');
          resolve();
          return;
        }

        const tx = db.transaction(storeNames, 'readonly');
        let completedStores = 0;

        storeNames.forEach((storeName) => {
          try {
            const store = tx.objectStore(storeName);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
              const count = countRequest.result;
              logger.info(`[IndexedDB Inspector] Store "${storeName}": ${count} items`);

              completedStores++;
              if (completedStores === storeNames.length) {
                logger.info('[IndexedDB Inspector] Inspection complete');
                resolve();
              }
            };

            countRequest.onerror = () => {
              logger.warn(`[IndexedDB Inspector] Could not count items in "${storeName}"`);
              completedStores++;
              if (completedStores === storeNames.length) {
                resolve();
              }
            };
          } catch (error) {
            logger.error(`[IndexedDB Inspector] Error inspecting store "${storeName}":`, error);
            completedStores++;
            if (completedStores === storeNames.length) {
              resolve();
            }
          }
        });

        tx.oncomplete = () => {
          db.close();
        };

        tx.onerror = () => {
          logger.error('[IndexedDB Inspector] Transaction error');
          resolve();
        };
      };

      request.onerror = () => {
        logger.warn(`[IndexedDB Inspector] Could not open IndexedDB "${dbName}"`);
        resolve();
      };

      request.onblocked = () => {
        logger.warn('[IndexedDB Inspector] Database open request blocked');
        resolve();
      };
    } catch (error) {
      logger.error('[IndexedDB Inspector] Failed to inspect IndexedDB:', error);
      resolve();
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

      logger.info('[IndexedDB] All databases:', names);
      return names;
    } else {
      logger.warn('[IndexedDB] indexedDB.databases() not supported in this browser');
      return [];
    }
  } catch (error) {
    logger.error('[IndexedDB] Failed to list databases:', error);
    return [];
  }
}
