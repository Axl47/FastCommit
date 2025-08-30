import * as vscode from 'vscode';
import { CommitMessageProvider } from './providers/CommitMessageProvider';

let commitMessageProvider: CommitMessageProvider | undefined;
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('QuickCommit extension is being activated...');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('QuickCommit');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('QuickCommit extension activated');

    try {
        // Initialize the commit message provider
        commitMessageProvider = new CommitMessageProvider(context, outputChannel);
        await commitMessageProvider.activate();

        outputChannel.appendLine('QuickCommit: Commit message provider registered successfully');

        // Show a welcome message on first activation
        const hasShownWelcome = context.globalState.get<boolean>('quickcommit.hasShownWelcome', false);
        if (!hasShownWelcome) {
            showWelcomeMessage(context);
            await context.globalState.update('quickcommit.hasShownWelcome', true);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`QuickCommit: Failed to activate: ${errorMessage}`);
        vscode.window.showErrorMessage(`QuickCommit: Failed to activate: ${errorMessage}`);
        console.error('QuickCommit activation error:', error);
    }
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('QuickCommit extension is being deactivated...');
    
    if (commitMessageProvider) {
        commitMessageProvider.dispose();
        commitMessageProvider = undefined;
    }

    if (outputChannel) {
        outputChannel.appendLine('QuickCommit extension deactivated');
        outputChannel.dispose();
        outputChannel = undefined;
    }
}

/**
 * Show welcome message to new users
 */
function showWelcomeMessage(context: vscode.ExtensionContext) {
    const message = `Welcome to QuickCommit! 🚀

QuickCommit generates AI-powered commit messages following conventional commit standards.

To get started:
1. Configure your API key (OpenAI, Anthropic, or OpenRouter)
2. Stage your changes in Git
3. Click the QuickCommit button in the Source Control panel

Would you like to configure your API key now?`;

    vscode.window.showInformationMessage(message, 'Configure API Key', 'Later')
        .then(selection => {
            if (selection === 'Configure API Key') {
                vscode.commands.executeCommand('quickcommit.configureApiKey');
            }
        });
}

/**
 * Get the current extension context (for testing purposes)
 */
export function getContext(): vscode.ExtensionContext | undefined {
    return commitMessageProvider?.extensionContext;
}