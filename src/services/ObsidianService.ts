import * as vscode from 'vscode';

export interface ObsidianConfiguration {
    enabled: boolean;
    url: string;
    vaultName: string;
    filePath: string;
    blockId: string;
}

/**
 * Service for integrating with Obsidian via its API
 */
export class ObsidianService {
    private static readonly CONFIG_SECTION = 'fastcommit.obsidian';
    
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get Obsidian configuration from VS Code settings
     */
    getConfiguration(): ObsidianConfiguration {
        const config = vscode.workspace.getConfiguration('fastcommit.obsidian');
        
        return {
            enabled: config.get<boolean>('enabled', false),
            url: config.get<string>('url', ''),
            vaultName: config.get<string>('vaultName', ''),
            filePath: config.get<string>('filePath', ''),
            blockId: config.get<string>('blockId', '')
        };
    }

    /**
     * Check if Obsidian integration is enabled and configured
     */
    isEnabled(): boolean {
        const config = this.getConfiguration();
        return config.enabled;
    }

    /**
     * Check if all required configuration is present
     */
    isConfigured(): boolean {
        const config = this.getConfiguration();
        return !!(
            config.enabled &&
            config.url &&
            config.vaultName &&
            config.filePath &&
            config.blockId
        );
    }

    /**
     * Get Obsidian API key from secure storage
     */
    async getApiKey(): Promise<string | undefined> {
        return await this.context.secrets.get('fastcommit.obsidian.apiKey');
    }

    /**
     * Set Obsidian API key in secure storage
     */
    async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('fastcommit.obsidian.apiKey', apiKey);
    }

    /**
     * Prompt user to enable Obsidian integration
     */
    async promptForEnabling(): Promise<boolean> {
        console.log('FastCommit: Showing Obsidian enablement prompt to user');
        
        const selection = await vscode.window.showInformationMessage(
            'FastCommit can integrate with Obsidian to automatically log your commit messages. Would you like to enable this feature?',
            'Yes, Enable', 'No, Don\'t Show Again'
        );

        console.log(`FastCommit: User selected: ${selection}`);

        if (selection === 'Yes, Enable') {
            console.log('FastCommit: Enabling Obsidian integration in workspace settings');
            await vscode.workspace.getConfiguration('fastcommit.obsidian').update('enabled', true, vscode.ConfigurationTarget.Workspace);
            console.log('FastCommit: Obsidian integration enabled successfully');
            return true;
        } else if (selection === 'No, Don\'t Show Again') {
            console.log('FastCommit: User declined Obsidian integration, marking as shown');
            // Store user's preference to not ask again
            await this.context.globalState.update('obsidian.promptShown', true);
        }

        return false;
    }

    /**
     * Check if we should prompt the user about Obsidian integration
     */
    shouldPromptForEnabling(): boolean {
        const config = this.getConfiguration();
        const promptShown = this.context.globalState.get<boolean>('obsidian.promptShown', false);
        
        // Only prompt if not already enabled and we haven't shown the prompt before
        return !config.enabled && !promptShown;
    }

    /**
     * Prompt user for complete Obsidian configuration
     */
    async promptForConfiguration(): Promise<boolean> {
        console.log('FastCommit: Starting Obsidian configuration prompts');
        
        // First, get the API key
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Obsidian API Key',
            password: true,
            placeHolder: 'Your Obsidian API key',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                }
                return null;
            }
        });

        if (!apiKey) {
            console.log('FastCommit: User cancelled API key input');
            return false;
        }
        
        console.log('FastCommit: API key provided, continuing with URL prompt');

        // Get the base URL
        const url = await vscode.window.showInputBox({
            prompt: 'Enter your Obsidian API URL',
            placeHolder: 'http://localhost:27123',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'URL cannot be empty';
                }
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (!url) {
            console.log('FastCommit: User cancelled URL input');
            return false;
        }
        
        console.log('FastCommit: URL provided, continuing with vault name prompt');

        // Get vault name
        const vaultName = await vscode.window.showInputBox({
            prompt: 'Enter your Obsidian vault name',
            placeHolder: 'MyVault',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Vault name cannot be empty';
                }
                return null;
            }
        });

        if (!vaultName) {
            console.log('FastCommit: User cancelled vault name input');
            return false;
        }
        
        console.log('FastCommit: Vault name provided, continuing with file path prompt');

        // Get file path
        const filePath = await vscode.window.showInputBox({
            prompt: 'Enter the file path within your vault',
            placeHolder: 'Projects/commits.md',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'File path cannot be empty';
                }
                return null;
            }
        });

        if (!filePath) {
            console.log('FastCommit: User cancelled file path input');
            return false;
        }
        
        console.log('FastCommit: File path provided, continuing with block ID prompt');

        // Get block ID
        const blockId = await vscode.window.showInputBox({
            prompt: 'Enter the block ID to prepend commits',
            placeHolder: 'commit-log',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Block ID cannot be empty';
                }
                return null;
            }
        });

        if (!blockId) {
            console.log('FastCommit: User cancelled block ID input');
            return false;
        }
        
        console.log('FastCommit: Block ID provided, all configuration collected');

        // Save all configuration
        console.log('FastCommit: Saving Obsidian configuration to workspace settings');
        const obsidianConfig = vscode.workspace.getConfiguration('fastcommit.obsidian');
        
        await obsidianConfig.update('enabled', true, vscode.ConfigurationTarget.Workspace);
        await obsidianConfig.update('url', url.trim(), vscode.ConfigurationTarget.Workspace);
        await obsidianConfig.update('vaultName', vaultName.trim(), vscode.ConfigurationTarget.Workspace);
        await obsidianConfig.update('filePath', filePath.trim(), vscode.ConfigurationTarget.Workspace);
        await obsidianConfig.update('blockId', blockId.trim(), vscode.ConfigurationTarget.Workspace);
        await this.setApiKey(apiKey.trim());

        console.log('FastCommit: Obsidian configuration saved successfully');
        vscode.window.showInformationMessage('Obsidian integration configured successfully!');
        return true;
    }

    /**
     * Send commit message to Obsidian
     */
    async sendCommitMessage(commitMessage: string): Promise<boolean> {
        if (!this.isEnabled() || !this.isConfigured()) {
            return false;
        }

        const apiKey = await this.getApiKey();
        if (!apiKey) {
            vscode.window.showWarningMessage('Obsidian API key not found. Please reconfigure Obsidian integration.');
            return false;
        }

        const config = this.getConfiguration();
        
        try {
            // Extract first line of commit message
            const commitFirstLine = commitMessage.split('\n')[0].trim();
            
            const success = await this.makeObsidianRequest(config, apiKey, commitFirstLine);
            
            if (success) {
                console.log('FastCommit: Successfully sent commit message to Obsidian');
                return true;
            } else {
                console.error('FastCommit: Failed to send commit message to Obsidian');
                return false;
            }
        } catch (error) {
            console.error('FastCommit: Error sending commit message to Obsidian:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Don't show error popup to avoid interrupting the user's workflow
            // Just log it for debugging
            vscode.window.showWarningMessage(
                `Failed to send commit message to Obsidian: ${errorMessage}`,
                'Configure Obsidian'
            ).then(selection => {
                if (selection === 'Configure Obsidian') {
                    vscode.commands.executeCommand('fastcommit.configureObsidian');
                }
            });
            
            return false;
        }
    }

    /**
     * Make the actual HTTP request to Obsidian API
     */
    private async makeObsidianRequest(config: ObsidianConfiguration, apiKey: string, commitFirstLine: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            const urlLib = require('url');
            
            const requestUrl = `${config.url}/${config.vaultName}/${config.filePath}`;
            const parsedUrl = urlLib.parse(requestUrl);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const requestBody = `- ${commitFirstLine}`;
            
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'Operation': 'prepend',
                    'Target-Type': 'block',
                    'Target': config.blockId
                }
            };

            const req = client.request(requestOptions, (res: any) => {
                let data = '';
                
                res.on('data', (chunk: any) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(true);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error: any) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.setTimeout(10000); // 10 second timeout
            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Test the Obsidian connection
     */
    async testConnection(): Promise<boolean> {
        if (!this.isConfigured()) {
            throw new Error('Obsidian integration is not configured');
        }

        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('Obsidian API key not found');
        }

        const config = this.getConfiguration();
        
        try {
            // Send a test message
            await this.makeObsidianRequest(config, apiKey, 'Test connection from FastCommit');
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Connection test failed: ${errorMessage}`);
        }
    }
}