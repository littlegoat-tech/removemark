import { type FileRouteTypes } from "@/routeTree.gen";
import { Sitemap } from "tanstack-router-sitemap";
import { readdirSync } from "fs";
import { join } from "path";

export type TRoutes = FileRouteTypes["fullPaths"];

export const sitemap: Sitemap<TRoutes> = {
  siteUrl: "https://removemark.app",
  defaultPriority: 0.5,
  routes: {
    "/": {
      priority: 1,
      changeFrequency: "daily",
    },
  },
};