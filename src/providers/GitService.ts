import * as vscode from 'vscode';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { shouldExcludeLockFile } from '../utils/exclusions';
import { QuickCommitIgnoreController } from '../utils/ignore';
import { getWorkspacePath } from '../utils/path';

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
 * Simplified Git service for QuickCommit
 * Handles Git operations and integrates with VS Code's Git extension
 */
export class GitService {
    private ignoreController: QuickCommitIgnoreController | null = null;
    private targetRepository: GitRepository | null = null;
    private workspaceRoot: string;

    constructor() {
        this.workspaceRoot = getWorkspacePath();
        this.initializeIgnoreController();
        this.configureRepositoryContext();
    }

    private async initializeIgnoreController(): Promise<void> {
        this.ignoreController = new QuickCommitIgnoreController(this.workspaceRoot);
        await this.ignoreController.initialize();
    }

    /**
     * Configure the repository context using VS Code's Git extension
     */
    private configureRepositoryContext(): void {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension?.isActive) {
                console.warn('VS Code Git extension not found or not active');
                return;
            }

            const gitApi = gitExtension.exports.getAPI(1);
            if (gitApi?.repositories && gitApi.repositories.length > 0) {
                // Use the first repository for now
                this.targetRepository = gitApi.repositories[0];
            }
        } catch (error) {
            console.error('Error configuring Git repository context:', error);
        }
    }

    /**
     * Gather information about changes (staged or unstaged)
     */
    async gatherChanges(options: GitProgressOptions): Promise<GitChange[]> {
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
        if (this.targetRepository) {
            this.targetRepository.inputBox.value = message;
            return;
        }

        // Fallback: copy to clipboard if Git extension API is not available
        this.copyToClipboard(message);
    }

    /**
     * Get complete context for commit message generation
     */
    async getCommitContext(changes: GitChange[], options: GitProgressOptions): Promise<string> {
        const { staged } = options;
        
        try {
            let context = '## Git Context for Commit Message Generation\n\n';

            // Add diff of changes
            try {
                const diff = await this.getDiffForChanges(options);
                const changeType = staged ? 'Staged' : 'Unstaged';
                context += `### Full Diff of ${changeType} Changes\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
            } catch (error) {
                const changeType = staged ? 'Staged' : 'Unstaged';
                context += `### Full Diff of ${changeType} Changes\n\`\`\`diff\n(No diff available)\n\`\`\`\n\n`;
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

    dispose(): void {
        // Cleanup if needed
    }
}