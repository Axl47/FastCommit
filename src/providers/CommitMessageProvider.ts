import * as vscode from 'vscode';
import { GitService, GitChange, GitProgressOptions } from './GitService';
import { ConfigurationManager } from '../config/settings';
import { completePrompt } from '../api';
import { createCommitMessagePrompt, extractCommitMessage, PromptParams } from '../prompts/commit-template';

/**
 * Main provider for AI-powered commit message generation in QuickCommit
 */
export class CommitMessageProvider {
    private gitService: GitService;
    private previousGitContext: string | null = null;
    private previousCommitMessage: string | null = null;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.gitService = new GitService();
    }

    /**
     * Activate the commit message provider
     */
    async activate(): Promise<void> {
        this.outputChannel.appendLine('QuickCommit commit message provider activated');
        
        // Initialize the Git service
        try {
            await this.gitService.initialize();
            this.outputChannel.appendLine('QuickCommit: Git service initialized');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`QuickCommit: Git service initialization failed: ${errorMessage}`);
            throw error;
        }

        // Register the main command
        const generateCommand = vscode.commands.registerCommand(
            'quickcommit.generateMessage',
            () => this.generateCommitMessage()
        );

        // Register configuration command
        const configCommand = vscode.commands.registerCommand(
            'quickcommit.configureApiKey',
            () => this.configureApiKey()
        );

        this.context.subscriptions.push(generateCommand);
        this.context.subscriptions.push(configCommand);
        this.context.subscriptions.push(this.gitService);
    }

    /**
     * Generate AI-powered commit message
     */
    async generateCommitMessage(): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.SourceControl,
                title: 'QuickCommit: Generating commit message...',
                cancellable: false,
            },
            async (progress) => {
                try {
                    // Validate configuration first
                    const configValidation = await ConfigurationManager.validateConfiguration(this.context);
                    if (!configValidation.valid) {
                        if (configValidation.error?.includes('API key not configured')) {
                            ConfigurationManager.showConfigurationInstructions();
                        } else {
                            vscode.window.showErrorMessage(`Configuration error: ${configValidation.error}`);
                        }
                        return;
                    }

                    // Try staged changes first
                    let staged = true;
                    let changes = await this.gitService.gatherChanges({ staged });

                    // If no staged changes and setting allows, try unstaged
                    if (changes.length === 0 && ConfigurationManager.shouldIncludeUnstaged()) {
                        staged = false;
                        changes = await this.gitService.gatherChanges({ staged });
                        if (changes.length > 0) {
                            vscode.window.showInformationMessage('QuickCommit: Generating message from unstaged changes');
                        } else {
                            vscode.window.showInformationMessage('QuickCommit: No changes found to analyze');
                            return;
                        }
                    }

                    if (changes.length === 0) {
                        vscode.window.showInformationMessage('QuickCommit: No changes found to analyze');
                        return;
                    }

                    // Report initial progress
                    progress.report({ increment: 10, message: 'Analyzing changes...' });

                    // Collect diff with progress tracking
                    let lastReportedProgress = 0;
                    const onDiffProgress = (percentage: number) => {
                        const currentProgress = (percentage / 100) * 70;
                        const increment = currentProgress - lastReportedProgress;
                        if (increment > 0) {
                            progress.report({ increment, message: 'Analyzing changes...' });
                            lastReportedProgress = currentProgress;
                        }
                    };

                    const gitContext = await this.gitService.getCommitContext(changes, {
                        staged,
                        onProgress: onDiffProgress,
                    });

                    // Generate commit message with AI
                    const commitMessage = await this.generateWithAI(gitContext, progress);

                    // Store for future reference
                    this.previousGitContext = gitContext;
                    this.previousCommitMessage = commitMessage;

                    // Set the commit message
                    this.gitService.setCommitMessage(commitMessage);
                    this.outputChannel.appendLine(`Generated commit message: ${commitMessage}`);
                    
                } catch (error) {
                    console.error('QuickCommit: Error in generateCommitMessage:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    
                    // Provide specific guidance for common errors
                    if (errorMessage.includes('API key is not configured')) {
                        vscode.window.showErrorMessage(
                            `QuickCommit: ${errorMessage}`,
                            'Configure API Key'
                        ).then(selection => {
                            if (selection === 'Configure API Key') {
                                vscode.commands.executeCommand('quickcommit.configureApiKey');
                            }
                        });
                    } else if (errorMessage.includes('API request failed')) {
                        vscode.window.showErrorMessage(
                            `QuickCommit: ${errorMessage}. Check your API key and internet connection.`
                        );
                    } else if (errorMessage.includes('No changes found')) {
                        vscode.window.showInformationMessage('QuickCommit: No changes found to analyze. Make some changes and try again.');
                    } else {
                        vscode.window.showErrorMessage(`QuickCommit: ${errorMessage}`);
                    }
                }
            }
        );
    }

    /**
     * Configure API key for the selected provider
     */
    async configureApiKey(): Promise<void> {
        const config = ConfigurationManager.getApiConfiguration();
        const success = await ConfigurationManager.promptForApiKey(this.context, config.apiProvider);
        
        if (success) {
            // Test the configuration
            const validation = await ConfigurationManager.validateConfiguration(this.context);
            if (validation.valid) {
                vscode.window.showInformationMessage(
                    `QuickCommit: ${ConfigurationManager.getProviderDisplayName(config.apiProvider)} API key configured successfully!`
                );
            } else {
                vscode.window.showErrorMessage(`Configuration validation failed: ${validation.error}`);
            }
        }
    }

    /**
     * Generate commit message using AI with progress updates
     */
    private async generateWithAI(
        gitContext: string,
        progress: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<string> {
        let totalProgressUsed = 0;
        const maxProgress = 20; // 20% reserved for AI processing
        const maxIncrement = 1.0;
        const minIncrement = 0.05;

        // Simulate progress while waiting for AI response
        const progressInterval = setInterval(() => {
            const remainingProgress = (maxProgress - totalProgressUsed) / maxProgress;
            const incrementLimited = Math.max(
                remainingProgress * remainingProgress * maxIncrement + minIncrement,
                minIncrement
            );
            const increment = Math.min(incrementLimited, maxProgress - totalProgressUsed);
            progress.report({ increment, message: 'Generating with AI...' });
            totalProgressUsed += increment;
        }, 100);

        try {
            const message = await this.callAIForCommitMessage(gitContext);

            // Complete progress animation
            for (let i = 0; i < maxProgress - totalProgressUsed; i++) {
                progress.report({ increment: 1 });
                await new Promise(resolve => setTimeout(resolve, 25));
            }

            return message;
        } finally {
            clearInterval(progressInterval);
        }
    }

    /**
     * Call AI service to generate commit message
     */
    private async callAIForCommitMessage(gitContext: string): Promise<string> {
        console.log('QuickCommit: Starting AI commit message generation');
        
        const config = await ConfigurationManager.getCompleteConfiguration(this.context);
        console.log('QuickCommit: API Configuration:', {
            provider: config.apiProvider,
            model: config.model,
            hasApiKey: !!config.apiKey,
            baseUrl: config.baseUrl
        });

        // Validate configuration
        if (!config.apiKey) {
            throw new Error(`API key is not configured for ${config.apiProvider}. Please run "QuickCommit: Configure API Key" command to set it up.`);
        }
        
        // Check if we should generate a different message
        const shouldGenerateDifferent = 
            this.previousGitContext === gitContext && this.previousCommitMessage !== null;

        // Build prompt parameters
        const promptParams: PromptParams = {
            gitContext,
            customInstructions: ConfigurationManager.getCustomTemplate() || undefined,
            previousMessage: shouldGenerateDifferent ? this.previousCommitMessage || undefined : undefined
        };

        const prompt = createCommitMessagePrompt(promptParams);
        
        // Estimate token count (rough approximation: 4 characters per token)
        const estimatedTokens = Math.ceil(prompt.length / 4);
        console.log('QuickCommit: Generated prompt stats:', {
            length: prompt.length,
            estimatedTokens: estimatedTokens,
            preview: prompt.substring(0, 500) + '...'
        });
        
        // Warn if prompt is very large
        if (estimatedTokens > 10000) {
            console.warn(`QuickCommit: Large prompt detected (${estimatedTokens} estimated tokens). This may cause issues with token limits.`);
        }
        
        try {
            // Call AI service
            console.log('QuickCommit: Calling AI service...');
            const response = await completePrompt(config, prompt);
            console.log('QuickCommit: Raw AI response:', response);
            
            // Extract and clean up the commit message
            const extractedMessage = extractCommitMessage(response);
            console.log('QuickCommit: Extracted commit message:', extractedMessage);
            
            if (!extractedMessage || extractedMessage.trim() === '') {
                throw new Error('AI service returned an empty commit message');
            }
            
            return extractedMessage;
        } catch (error) {
            console.error('QuickCommit: Error in AI call:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to generate commit message: ${errorMessage}`);
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.gitService.dispose();
    }

    /**
     * Get the extension context (for testing and external access)
     */
    get extensionContext(): vscode.ExtensionContext {
        return this.context;
    }
}