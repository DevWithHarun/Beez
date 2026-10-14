import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the launch app route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/app");

    expect(matches.at(-1)?.routeId).toBe("/app");
  });

  it("matches separate merchant and rider workspace routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/merchant").at(-1)?.routeId).toBe("/merchant");
    expect(router.matchRoutes("/rider").at(-1)?.routeId).toBe("/rider");
  });

  it("matches the admin dashboard route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/admin").at(-1)?.routeId).toBe("/admin");
  });

  it("matches guest Discover and direct public shop routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/discover").at(-1)?.routeId).toBe("/discover");
    expect(router.matchRoutes("/m/mama-neema").at(-1)?.routeId).toBe("/m/$slug");
  });
});
