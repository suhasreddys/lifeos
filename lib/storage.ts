import path from "path";
import os from "os";
import { mkdir, readFile, writeFile } from "fs/promises";

/**
 * Returns a writable directory path for data files.
 * On Vercel / Serverless environments, uses os.tmpdir() (/tmp) to prevent EROFS read-only errors.
 * On local dev, uses process.cwd()/data.
 */
export function getStorageDir(subfolder: string): string {
  const baseDir = process.env.VERCEL || process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "lifeos-data")
    : path.join(process.cwd(), "data");

  return path.join(baseDir, subfolder);
}

export async function readJsonStorage<T>(subfolder: string, filename: string, fallback: T): Promise<T> {
  const dir = getStorageDir(subfolder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);

  try {
    const data = await readFile(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // If file doesn't exist in /tmp on Vercel, try reading from seed process.cwd()/data
      try {
        const seedPath = path.join(process.cwd(), "data", subfolder, filename);
        const seedData = await readFile(seedPath, "utf8");
        const parsed = JSON.parse(seedData) as T;
        // Copy seed data into writable dir
        await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
        return parsed;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function writeJsonStorage<T>(subfolder: string, filename: string, data: T): Promise<void> {
  const dir = getStorageDir(subfolder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
