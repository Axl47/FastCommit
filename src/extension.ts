import * as vscode from 'vscode';
import { CommitMessageProvider } from './providers/CommitMessageProvider';
import { ConfigurationManager } from './config/settings';

let commitMessageProvider: CommitMessageProvider | undefined;
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('FastCommit extension is being activated...');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('FastCommit');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('FastCommit extension activated');

    try {
        // Ensure Git extension is activated first
        await ensureGitExtensionActivated(outputChannel);

        // Initialize the commit message provider
        commitMessageProvider = new CommitMessageProvider(context, outputChannel);
        await commitMessageProvider.activate();

        outputChannel.appendLine('FastCommit: Commit message provider registered successfully');

        // Show a welcome message on first activation
        const hasShownWelcome = context.globalState.get<boolean>('fastcommit.hasShownWelcome', false);
        if (!hasShownWelcome) {
            showWelcomeMessage(context);
            await context.globalState.update('fastcommit.hasShownWelcome', true);
        }

        // Handle Obsidian initial setup prompt
        await handleObsidianInitialSetup(context);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`FastCommit: Failed to activate: ${errorMessage}`);
        vscode.window.showErrorMessage(`FastCommit: Failed to activate: ${errorMessage}`);
        console.error('FastCommit activation error:', error);
    }
}

/**
 * Ensure the Git extension is activated and ready
 */
async function ensureGitExtensionActivated(outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        
        if (!gitExtension) {
            throw new Error('VS Code Git extension not found');
        }

        if (!gitExtension.isActive) {
            outputChannel.appendLine('FastCommit: Activating Git extension...');
            await gitExtension.activate();
            outputChannel.appendLine('FastCommit: Git extension activated');
        } else {
            outputChannel.appendLine('FastCommit: Git extension already active');
        }

        // Verify we can access the Git API
        const gitApi = gitExtension.exports?.getAPI(1);
        if (!gitApi) {
            throw new Error('Failed to access Git API');
        }

        outputChannel.appendLine(`FastCommit: Git API available with ${gitApi.repositories?.length || 0} repositories`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Git extension error';
        outputChannel.appendLine(`FastCommit: Git extension issue: ${errorMessage}`);
        throw new Error(`Git extension required for FastCommit: ${errorMessage}`);
    }
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('FastCommit extension is being deactivated...');
    
    if (commitMessageProvider) {
        commitMessageProvider.dispose();
        commitMessageProvider = undefined;
    }

    if (outputChannel) {
        outputChannel.appendLine('FastCommit extension deactivated');
        outputChannel.dispose();
        outputChannel = undefined;
    }
}

/**
 * Show welcome message to new users
 */
function showWelcomeMessage(context: vscode.ExtensionContext) {
    const message = `Welcome to FastCommit! 🚀

FastCommit generates AI-powered commit messages following conventional commit standards.

To get started:
1. Configure your API key (OpenAI, Anthropic, or OpenRouter)
2. Stage your changes in Git
3. Click the FastCommit button in the Source Control panel

Would you like to configure your API key now?`;

    vscode.window.showInformationMessage(message, 'Configure API Key', 'Later')
        .then(selection => {
            if (selection === 'Configure API Key') {
                vscode.commands.executeCommand('fastcommit.configureApiKey');
            }
        });
}

/**
 * Handle initial Obsidian setup prompt
 */
async function handleObsidianInitialSetup(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Only prompt after a slight delay to avoid overwhelming user during activation
        setTimeout(async () => {
            await ConfigurationManager.handleObsidianInitialPrompt(context);
        }, 2000); // 2 second delay
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('FastCommit: Error in Obsidian initial setup:', error);
        if (outputChannel) {
            outputChannel.appendLine(`FastCommit: Obsidian setup error: ${errorMessage}`);
        }
    }
}

/**
 * Get the current extension context (for testing purposes)
 */
export function getContext(): vscode.ExtensionContext | undefined {
    return commitMessageProvider?.extensionContext;
}