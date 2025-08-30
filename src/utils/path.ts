import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Convert Windows-style paths to POSIX-style for consistent presentation
 */
export function toPosixPath(p: string): string {
    const isExtendedLengthPath = p.startsWith('\\\\?\\');
    if (isExtendedLengthPath) {
        return p;
    }
    return p.replace(/\\/g, '/');
}

/**
 * Get the workspace path for the current VS Code workspace
 */
export function getWorkspacePath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return process.cwd();
    }
    
    // If there's an active text editor, try to get its workspace
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
    }
    
    // Default to first workspace folder
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Normalize a file path for consistent comparison
 */
export function normalizePath(filePath: string): string {
    let normalized = path.normalize(filePath);
    
    // Remove trailing slash, except for root paths
    if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
        normalized = normalized.slice(0, -1);
    }
    
    return normalized;
}

/**
 * Check if two paths are equal across platforms
 */
export function arePathsEqual(path1?: string, path2?: string): boolean {
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    
    const normalized1 = normalizePath(path1);
    const normalized2 = normalizePath(path2);
    
    if (process.platform === 'win32') {
        return normalized1.toLowerCase() === normalized2.toLowerCase();
    }
    return normalized1 === normalized2;
}