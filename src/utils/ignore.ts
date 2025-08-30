import * as path from 'path';
import ignore, { Ignore } from 'ignore';
import { fileExistsAtPath, readFileContent } from './fs';
import { normalizePath } from './path';

/**
 * Simplified ignore controller for FastCommit
 * Supports .gitignore files in the workspace root
 */
export class FastCommitIgnoreController {
    private ignoreInstance: Ignore;
    private hasIgnoreFile: boolean = false;

    constructor(private workspaceRoot: string) {
        this.ignoreInstance = ignore();
    }

    /**
     * Initialize the ignore controller by loading .gitignore if it exists
     */
    async initialize(): Promise<void> {
        try {
            const ignorePath = path.join(this.workspaceRoot, '.gitignore');
            
            if (await fileExistsAtPath(ignorePath)) {
                const content = await readFileContent(ignorePath);
                if (content.trim()) {
                    this.ignoreInstance.add(content);
                    this.hasIgnoreFile = true;
                    
                    // Always ignore the .gitignore file itself
                    this.ignoreInstance.add('.gitignore');
                }
            }
        } catch (error) {
            console.warn('Error loading .gitignore:', error);
        }
    }

    /**
     * Check if a file should be accessible (not ignored)
     * @param filePath - Path to check (can be absolute or relative)
     * @returns true if file is accessible, false if ignored
     */
    validateAccess(filePath: string): boolean {
        // If no ignore file exists, allow access to everything
        if (!this.hasIgnoreFile) {
            return true;
        }

        try {
            // Convert to relative path from workspace root
            const absolutePath = path.resolve(this.workspaceRoot, filePath);
            const relativePath = path.relative(this.workspaceRoot, absolutePath);
            
            // Normalize to use forward slashes for ignore matching
            const normalizedPath = relativePath.replace(/\\/g, '/');
            
            return !this.ignoreInstance.ignores(normalizedPath);
        } catch (error) {
            console.warn(`Error validating access for ${filePath}:`, error);
            return true; // Default to allowing access on error
        }
    }

    /**
     * Get a user-friendly status message about ignored files
     */
    getStatusMessage(): string {
        if (!this.hasIgnoreFile) {
            return 'No .gitignore file found - all files will be included';
        }
        return 'Using .gitignore to filter files';
    }
}