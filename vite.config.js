import { defineConfig } from "vite";

export default defineConfig({
  base: "/tweet/",
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
  },
});
