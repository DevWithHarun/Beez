type ExtendableWorkerEvent = {
  waitUntil(promise: Promise<unknown>): void;
};

type WorkerFetchEvent = ExtendableWorkerEvent & {
  request: Request;
  respondWith(response: Promise<Response>): void;
};

type WorkerPushEvent = ExtendableWorkerEvent & { data: unknown };
type WorkerNotificationEvent = ExtendableWorkerEvent & {
  notification: { close(): void };
};

type StaticAssetWorker = {
  addEventListener(
    type: "install" | "activate",
    listener: (event: ExtendableWorkerEvent) => void,
  ): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
  addEventListener(type: "push", listener: (event: WorkerPushEvent) => void): void;
  addEventListener(
    type: "notificationclick",
    listener: (event: WorkerNotificationEvent) => void,
  ): void;
  skipWaiting(): Promise<void>;
  registration: {
    showNotification(title: string, options: { body: string; tag: string }): Promise<void>;
  };
  clients: {
    claim(): Promise<void>;
    matchAll(options: {
      type: "window";
      includeUncontrolled: boolean;
    }): Promise<Array<{ url: string; focus(): Promise<unknown> }>>;
    openWindow(url: string): Promise<unknown>;
  };
  location: Location;
};

const worker = globalThis as unknown as StaticAssetWorker;
const cacheName = "beez-static-v3";
const precache = [
  "/manifest.webmanifest",
  "/beez-logo.png",
  "/beez-onboarding-logo.png",
  "/global-map.png",
];
const staticDestinations = new Set(["style", "script", "image", "font"]);
const publicAssetPath =
  /^(?:\/assets\/)|^\/(?:manifest\.webmanifest|beez-logo\.png|beez-onboarding-logo\.png|global-map\.png|favicon\.png)$/;

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then(async (cache) => {
      await cache.addAll(precache);
      await worker.skipWaiting();
    }),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("beez-static-") && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    request.mode === "navigate" ||
    url.origin !== worker.location.origin ||
    !publicAssetPath.test(url.pathname) ||
    !staticDestinations.has(request.destination)
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

worker.addEventListener("push", (event) => {
  event.waitUntil(
    worker.registration.showNotification("New paid order", {
      body: "A new paid order is waiting in your Beez merchant inbox.",
      tag: "beez-merchant-paid-order",
    }),
  );
});

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    worker.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const merchantWindow = windows.find(
        (client) =>
          new URL(client.url).origin === worker.location.origin &&
          new URL(client.url).pathname === "/merchant",
      );
      if (merchantWindow) {
        await merchantWindow.focus();
      } else {
        await worker.clients.openWindow("/merchant");
      }
    }),
  );
});
