import * as fs from 'fs/promises';

/**
 * Check if a file exists at the given path
 */
export async function fileExistsAtPath(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safely read a file and return its content as string
 */
export async function readFileContent(path: string): Promise<string> {
    try {
        return await fs.readFile(path, 'utf-8');
    } catch (error) {
        console.warn(`Failed to read file ${path}:`, error);
        return '';
    }
}