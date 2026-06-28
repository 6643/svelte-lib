import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 注意：这些函数使用 Bun 特有的 API（Bun.CryptoHasher），需要在 Bun 环境中运行
import {
  acquirePublishLock,
  createBuildNonce,
  createStageDir,
  createTempOutDir,
  publishBuildOutput,
} from "../build-publish";

describe("build-publish", () => {
  describe("createBuildNonce", () => {
    it("should return a non-empty hex string", () => {
      const nonce = createBuildNonce();
      expect(nonce.length).toBeGreaterThan(0);
      expect(nonce).toMatch(/^[0-9a-f]+$/);
    });

    it("should return unique values on each call", () => {
      const a = createBuildNonce();
      const b = createBuildNonce();
      expect(a).not.toBe(b);
    });
  });

  describe("createStageDir and createTempOutDir", () => {
    it("should create stage dir path under rootDir", () => {
      const nonce = createBuildNonce();
      const stageDir = createStageDir("/root", "/root/dist", nonce);
      expect(stageDir.startsWith("/root/")).toBe(true);
      expect(stageDir.includes(nonce)).toBe(true);
    });

    it("should create temp out dir path alongside outDir", () => {
      const nonce = createBuildNonce();
      const tempDir = createTempOutDir("/root/dist", nonce);
      expect(tempDir.startsWith("/root/")).toBe(true);
      expect(tempDir.includes(".bsp-out-")).toBe(true);
    });
  });

  describe("acquirePublishLock", () => {
    it("should acquire lock on fresh directory", async () => {
      const testDir = join("/tmp", `svelte-lib-test-lock-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");

      const lock = await acquirePublishLock(testDir, outDir);
      expect(lock.ok).toBe(true);
      if (lock.ok) {
        expect(existsSync(lock.value)).toBe(true);
        // Cleanup
        await (await import("node:fs/promises")).rm(lock.value, { force: true, recursive: true });
      }
      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });

    it("should fail when lock is held by a live process", async () => {
      const testDir = join("/tmp", `svelte-lib-test-lock-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");
      const lockPath = `${outDir}.lock`;
      const ownerPath = join(lockPath, "owner.json");

      // Create lock as if held by current process
      mkdirSync(lockPath, { recursive: true });
      writeFileSync(ownerPath, JSON.stringify({ pid: process.pid }));

      const lock = await acquirePublishLock(testDir, outDir, false);
      expect(lock.ok).toBe(false);
      if (!lock.ok) {
        expect(lock.error).toContain("already running");
      }

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });
  });

  describe("publishBuildOutput", () => {
    it("should publish temp dir to outDir atomically", async () => {
      const testDir = join("/tmp", `svelte-lib-test-pub-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");
      const tempOutDir = join(testDir, ".dist.bsp-out-test");
      mkdirSync(tempOutDir, { recursive: true });
      writeFileSync(join(tempOutDir, "test.txt"), "hello");

      const result = await publishBuildOutput(testDir, tempOutDir, outDir);
      expect(result.ok).toBe(true);
      expect(existsSync(join(outDir, "test.txt"))).toBe(true);
      expect(existsSync(tempOutDir)).toBe(false);

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });

    it("should handle missing original outDir gracefully", async () => {
      const testDir = join("/tmp", `svelte-lib-test-pub-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist-nonexistent");
      const tempOutDir = join(testDir, ".dist-nonexistent.bsp-out-test");
      mkdirSync(tempOutDir, { recursive: true });
      writeFileSync(join(tempOutDir, "test.txt"), "hello");

      const result = await publishBuildOutput(testDir, tempOutDir, outDir);
      expect(result.ok).toBe(true);

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });
  });
});
