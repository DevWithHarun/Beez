export type QueuedReadyAction = {
  userId: string;
  orderId: string;
  createdAt: number;
  conflict?: string;
};

const DATABASE_NAME = "beez-merchant-actions";
const STORE_NAME = "ready-actions";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("Offline order actions are not supported in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline order storage failed."));
    request.onblocked = () => reject(new Error("Offline order storage is blocked by another tab."));
  });
}

function actionKey(action: Pick<QueuedReadyAction, "userId" | "orderId">) {
  return `${action.userId}:${action.orderId}`;
}

export async function listQueuedReadyActions(userId: string): Promise<QueuedReadyAction[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .index("userId")
        .getAll(userId);
      request.onsuccess = () => resolve(request.result as QueuedReadyAction[]);
      request.onerror = () =>
        reject(request.error ?? new Error("Offline order actions could not be loaded."));
    });
  } finally {
    database.close();
  }
}

export async function queueReadyAction(userId: string, orderId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const action = { userId, orderId, createdAt: Date.now() };
      const request = database
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put({ ...action, key: actionKey(action) });
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("The Ready action could not be queued."));
    });
  } finally {
    database.close();
  }
}

export async function removeQueuedReadyAction(
  action: Pick<QueuedReadyAction, "userId" | "orderId">,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(actionKey(action));
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("The completed Ready action could not be removed."));
    });
  } finally {
    database.close();
  }
}

export async function markQueuedReadyConflict(
  action: QueuedReadyAction,
  conflict: string,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put({ ...action, conflict, key: actionKey(action) });
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("The offline order conflict could not be saved."));
    });
  } finally {
    database.close();
  }
}
