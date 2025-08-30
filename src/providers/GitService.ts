import * as vscode from 'vscode';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { shouldExcludeLockFile } from '../utils/exclusions';
import { FastCommitIgnoreController } from '../utils/ignore';
import { getWorkspacePath } from '../utils/path';

// Maximum size for diff content (approximately 10,000 tokens)
const MAX_DIFF_SIZE = 40000;

export interface GitChange {
    filePath: string;
    status: string;
}

export interface GitOptions {
    staged: boolean;
}

export interface GitProgressOptions extends GitOptions {
    onProgress?: (percentage: number) => void;
}

export interface GitRepository {
    inputBox: { value: string };
    rootUri?: vscode.Uri;
}

/**
 * Simplified Git service for FastCommit
 * Handles Git operations and integrates with VS Code's Git extension
 */
export class GitService {
    private ignoreController: FastCommitIgnoreController | null = null;
    private targetRepository: GitRepository | null = null;
    private workspaceRoot: string;
    private isInitialized: boolean = false;

    constructor() {
        this.workspaceRoot = getWorkspacePath();
    }

    /**
     * Initialize the GitService asynchronously
     * Must be called before using any Git operations
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        await this.initializeIgnoreController();
        this.isInitialized = true;
    }

    private async initializeIgnoreController(): Promise<void> {
        this.ignoreController = new FastCommitIgnoreController(this.workspaceRoot);
        await this.ignoreController.initialize();
    }

    /**
     * Configure the repository context using VS Code's Git extension
     * This should be called before each Git operation to ensure we have the right repository
     */
    private configureRepositoryContext(resourceUri?: vscode.Uri): void {
        try {
            console.log('FastCommit: Configuring repository context...');
            
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension?.isActive) {
                console.warn('FastCommit: VS Code Git extension not found or not active');
                return;
            }

            const gitApi = gitExtension.exports.getAPI(1);
            const repositories = gitApi?.repositories;
            
            console.log(`FastCommit: Found ${repositories?.length || 0} Git repositories`);
            
            if (!repositories || repositories.length === 0) {
                console.warn('FastCommit: No Git repositories found');
                this.targetRepository = null;
                return;
            }

            // Log all available repositories
            repositories.forEach((repo: any, index: number) => {
                console.log(`FastCommit: Repository ${index}: ${repo.rootUri?.fsPath || 'no path'}`);
            });

            // Try to find the repository that matches the provided URI or current workspace
            if (resourceUri) {
                console.log(`FastCommit: Looking for repository matching resource URI: ${resourceUri.fsPath}`);
                for (const repo of repositories) {
                    if (repo.rootUri && resourceUri.fsPath.startsWith(repo.rootUri.fsPath)) {
                        this.targetRepository = repo;
                        console.log(`FastCommit: Selected repository by resource URI: ${repo.rootUri.fsPath}`);
                        return;
                    }
                }
            }

            // If no specific resource URI or no matching repository found,
            // try to find one that matches our workspace root
            console.log(`FastCommit: Looking for repository matching workspace root: ${this.workspaceRoot}`);
            for (const repo of repositories) {
                if (repo.rootUri && repo.rootUri.fsPath === this.workspaceRoot) {
                    this.targetRepository = repo;
                    console.log(`FastCommit: Selected repository by workspace root: ${repo.rootUri.fsPath}`);
                    return;
                }
            }

            // Fallback to the first repository
            this.targetRepository = repositories[0];
            console.log(`FastCommit: Using first repository as fallback: ${this.targetRepository?.rootUri?.fsPath || 'unknown'}`);
            
        } catch (error) {
            console.error('FastCommit: Error configuring Git repository context:', error);
            this.targetRepository = null;
        }
    }

    /**
     * Gather information about changes (staged or unstaged)
     */
    async gatherChanges(options: GitProgressOptions): Promise<GitChange[]> {
        // Ensure we're initialized and have repository context
        if (!this.isInitialized) {
            await this.initialize();
        }
        this.configureRepositoryContext();

        try {
            const statusOutput = this.getStatus(options);
            if (!statusOutput.trim()) {
                return [];
            }

            const changes: GitChange[] = [];
            const lines = statusOutput.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.length < 2) continue;

                const statusCode = line.substring(0, 1).trim();
                const filePath = line.substring(1).trim();
                const absolutePath = path.join(this.workspaceRoot, filePath);

                changes.push({
                    filePath: absolutePath,
                    status: this.getChangeStatusFromCode(statusCode)
                });
            }

            return changes;
        } catch (error) {
            const changeType = options.staged ? 'staged' : 'unstaged';
            console.error(`Error gathering ${changeType} changes:`, error);
            return [];
        }
    }

    /**
     * Set the commit message in the Git input box
     */
    setCommitMessage(message: string): void {
        // Ensure we have the latest repository context
        this.configureRepositoryContext();
        
        console.log('FastCommit: Setting commit message:', message);
        console.log('FastCommit: Target repository:', this.targetRepository?.rootUri?.fsPath || 'null');
        
        if (this.targetRepository) {
            try {
                console.log('FastCommit: Repository details:', {
                    rootUri: this.targetRepository.rootUri?.fsPath,
                    inputBoxExists: !!this.targetRepository.inputBox,
                    currentInputValue: this.targetRepository.inputBox?.value || 'undefined'
                });
                
                const oldValue = this.targetRepository.inputBox.value;
                this.targetRepository.inputBox.value = message;
                
                console.log('FastCommit: Input box value change:', {
                    before: oldValue,
                    after: this.targetRepository.inputBox.value,
                    messageSet: message
                });
                
                // Verify the value was actually set
                if (this.targetRepository.inputBox.value === message) {
                    console.log('FastCommit: Commit message set in Git input box successfully - VERIFIED');
                    vscode.window.showInformationMessage('FastCommit: Commit message generated and set!');
                } else {
                    console.warn('FastCommit: Commit message was not properly set - value mismatch');
                    vscode.window.showWarningMessage('Commit message generation completed but may not have been set properly');
                }
                return;
            } catch (error) {
                console.error('FastCommit: Error setting commit message in Git input box:', error);
                vscode.window.showWarningMessage('Failed to set commit message in Git box, copying to clipboard instead');
            }
        }

        // Fallback: copy to clipboard if Git extension API is not available
        console.warn('FastCommit: No Git repository context available, copying to clipboard as fallback');
        this.copyToClipboard(message);
    }

    /**
     * Get complete context for commit message generation
     */
    async getCommitContext(changes: GitChange[], options: GitProgressOptions): Promise<string> {
        // Ensure we're initialized and have repository context
        if (!this.isInitialized) {
            await this.initialize();
        }
        this.configureRepositoryContext();

        const { staged } = options;
        
        try {
            let context = '## Git Context for Commit Message Generation\n\n';

            // Add diff of changes with smart truncation
            try {
                const diff = await this.getDiffForChanges(options);
                const changeType = staged ? 'Staged' : 'Unstaged';
                
                if (diff.length > MAX_DIFF_SIZE) {
                    console.log(`FastCommit: Diff is too large (${diff.length} chars), creating file summary instead`);
                    
                    // Create a summary of changed files instead of full diff
                    const filesSummary = this.createFilesSummary(changes);
                    context += `### ${changeType} Changes Summary (Diff truncated due to size)\n\n${filesSummary}\n\n`;
                } else {
                    context += `### Full Diff of ${changeType} Changes\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
                }
            } catch (error) {
                const changeType = staged ? 'Staged' : 'Unstaged';
                console.error('FastCommit: Error getting diff, falling back to file summary:', error);
                
                // Fallback to file summary if diff fails
                const filesSummary = this.createFilesSummary(changes);
                context += `### ${changeType} Changes Summary (Diff unavailable)\n\n${filesSummary}\n\n`;
            }

            // Add summary
            try {
                const summary = this.getSummary(options);
                context += `### Statistical Summary\n\`\`\`\n${summary}\n\`\`\`\n\n`;
            } catch (error) {
                context += `### Statistical Summary\n\`\`\`\n(No summary available)\n\`\`\`\n\n`;
            }

            // Add repository context
            context += '### Repository Context\n\n';

            // Current branch
            try {
                const currentBranch = this.getCurrentBranch();
                if (currentBranch) {
                    context += `**Current branch:** \`${currentBranch.trim()}\`\n\n`;
                }
            } catch (error) {
                // Skip if not available
            }

            // Recent commits
            try {
                const recentCommits = this.getRecentCommits();
                if (recentCommits) {
                    context += `**Recent commits:**\n\`\`\`\n${recentCommits}\n\`\`\`\n`;
                }
            } catch (error) {
                // Skip if not available
            }

            return context;
        } catch (error) {
            console.error('Error generating commit context:', error);
            return '## Error generating commit context\n\nUnable to gather complete context for commit message generation.';
        }
    }

    /**
     * Execute git command and return output
     */
    private executeGitCommand(args: string[]): string {
        try {
            const result = spawnSync('git', args, {
                cwd: this.workspaceRoot,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });

            if (result.error) {
                throw result.error;
            }

            if (result.status !== 0) {
                throw new Error(`Git command failed with status ${result.status}: ${result.stderr}`);
            }

            return result.stdout;
        } catch (error) {
            console.error(`Error executing git command: git ${args.join(' ')}`, error);
            throw error;
        }
    }

    private getStatus(options: GitOptions): string {
        const { staged } = options;
        const args = staged ? ['diff', '--name-status', '--cached'] : ['diff', '--name-status'];
        return this.executeGitCommand(args);
    }

    private getSummary(options: GitOptions): string {
        const { staged } = options;
        const args = staged ? ['diff', '--cached', '--stat'] : ['diff', '--stat'];
        return this.executeGitCommand(args);
    }

    private async getDiffForChanges(options: GitProgressOptions): Promise<string> {
        const { staged, onProgress } = options;
        
        try {
            const diffs: string[] = [];
            const args = staged ? ['diff', '--name-only', '--cached'] : ['diff', '--name-only'];
            const files = this.executeGitCommand(args)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            let processedFiles = 0;
            for (const filePath of files) {
                const shouldInclude = this.ignoreController?.validateAccess(filePath) !== false && 
                                   !shouldExcludeLockFile(filePath);
                
                if (shouldInclude) {
                    const diff = this.getGitDiff(filePath, { staged }).trim();
                    if (diff) {
                        diffs.push(diff);
                    }
                }

                processedFiles++;
                if (onProgress && files.length > 0) {
                    const percentage = (processedFiles / files.length) * 100;
                    onProgress(percentage);
                }
            }

            return diffs.join('\n');
        } catch (error) {
            const changeType = staged ? 'staged' : 'unstaged';
            console.error(`Error generating ${changeType} diff:`, error);
            return '';
        }
    }

    private getGitDiff(filePath: string, options: GitOptions): string {
        const { staged } = options;
        const args = staged ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath];
        return this.executeGitCommand(args);
    }

    private getCurrentBranch(): string {
        return this.executeGitCommand(['branch', '--show-current']);
    }

    private getRecentCommits(count: number = 5): string {
        return this.executeGitCommand(['log', '--oneline', `-${count}`]);
    }

    private copyToClipboard(message: string): void {
        try {
            vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage(
                'Commit message copied to clipboard. Paste it into the commit message field.'
            );
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            vscode.window.showErrorMessage('Failed to set commit message');
        }
    }

    private getChangeStatusFromCode(code: string): string {
        switch (code) {
            case 'M': return 'Modified';
            case 'A': return 'Added';
            case 'D': return 'Deleted';
            case 'R': return 'Renamed';
            case 'C': return 'Copied';
            case 'U': return 'Updated';
            case '?': return 'Untracked';
            default: return 'Unknown';
        }
    }

    /**
     * Create a summary of changed files when diff is too large
     */
    private createFilesSummary(changes: GitChange[]): string {
        if (changes.length === 0) {
            return 'No changes detected.';
        }

        // Group changes by status
        const added: string[] = [];
        const modified: string[] = [];
        const deleted: string[] = [];
        const renamed: string[] = [];
        const other: string[] = [];

        changes.forEach(change => {
            const relativePath = path.relative(this.workspaceRoot, change.filePath);
            
            switch (change.status.toLowerCase()) {
                case 'added':
                case 'a':
                    added.push(relativePath);
                    break;
                case 'modified':
                case 'm':
                    modified.push(relativePath);
                    break;
                case 'deleted':
                case 'd':
                    deleted.push(relativePath);
                    break;
                case 'renamed':
                case 'r':
                    renamed.push(relativePath);
                    break;
                default:
                    other.push(`${relativePath} (${change.status})`);
                    break;
            }
        });

        let summary = '';
        
        if (modified.length > 0) {
            summary += `**Modified Files (${modified.length}):**\n`;
            modified.forEach(file => summary += `- ${file}\n`);
            summary += '\n';
        }
        
        if (added.length > 0) {
            summary += `**Added Files (${added.length}):**\n`;
            added.forEach(file => summary += `- ${file}\n`);
            summary += '\n';
        }
        
        if (deleted.length > 0) {
            summary += `**Deleted Files (${deleted.length}):**\n`;
            deleted.forEach(file => summary += `- ${file}\n`);
            summary += '\n';
        }
        
        if (renamed.length > 0) {
            summary += `**Renamed Files (${renamed.length}):**\n`;
            renamed.forEach(file => summary += `- ${file}\n`);
            summary += '\n';
        }
        
        if (other.length > 0) {
            summary += `**Other Changes (${other.length}):**\n`;
            other.forEach(file => summary += `- ${file}\n`);
            summary += '\n';
        }

        summary += `**Total: ${changes.length} file${changes.length === 1 ? '' : 's'} changed**`;
        
        return summary;
    }

    dispose(): void {
        // Cleanup if needed
    }
}