import * as vscode from 'vscode';
import { ApiConfiguration } from '../api';
import { getDefaultModelConfig } from '../prompts/commit-template';

/**
 * Configuration management for FastCommit extension
 */
export class ConfigurationManager {
    private static readonly CONFIG_SECTION = 'fastcommit';
    
    /**
     * Get the current API configuration from VS Code settings
     */
    static getApiConfiguration(): ApiConfiguration {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const provider = config.get<string>('apiProvider', 'openai') as 'openai' | 'anthropic' | 'openrouter';
        
        // Get model from settings or use default
        let model = config.get<string>('model');
        if (!model) {
            const defaultConfig = getDefaultModelConfig(provider);
            model = defaultConfig.model;
        }

        return {
            apiProvider: provider,
            model,
            temperature: 1, // Fixed low temperature for consistent commit messages
            maxTokens: 30000,   // Increased limit to handle large diffs and complex commit messages
            // API key will be retrieved separately from secrets
        };
    }

    /**
     * Get API key from VS Code secret storage
     */
    static async getApiKey(context: vscode.ExtensionContext, provider: string): Promise<string | undefined> {
        const keyName = `fastcommit.${provider}.apiKey`;
        return await context.secrets.get(keyName);
    }

    /**
     * Set API key in VS Code secret storage
     */
    static async setApiKey(context: vscode.ExtensionContext, provider: string, apiKey: string): Promise<void> {
        const keyName = `fastcommit.${provider}.apiKey`;
        await context.secrets.store(keyName, apiKey);
    }

    /**
     * Get complete configuration including API key
     */
    static async getCompleteConfiguration(context: vscode.ExtensionContext): Promise<ApiConfiguration> {
        const config = this.getApiConfiguration();
        const apiKey = await this.getApiKey(context, config.apiProvider);
        
        if (!apiKey) {
            throw new Error(`API key not configured for ${config.apiProvider}. Please run "FastCommit: Configure API Key" command.`);
        }

        return {
            ...config,
            apiKey
        };
    }

    /**
     * Get custom template from settings
     */
    static getCustomTemplate(): string {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<string>('customTemplate', '');
    }

    /**
     * Check if unstaged changes should be included
     */
    static shouldIncludeUnstaged(): boolean {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<boolean>('includeUnstaged', true);
    }

    /**
     * Check if lock files should be excluded
     */
    static shouldExcludeLockFiles(): boolean {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<boolean>('excludeLockFiles', true);
    }

    /**
     * Prompt user to configure API key
     */
    static async promptForApiKey(context: vscode.ExtensionContext, provider: string): Promise<boolean> {
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
        
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter your ${providerName} API key`,
            password: true,
            placeHolder: 'sk-...' + (provider === 'anthropic' ? ' or claude-...' : ''),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                }
                return null;
            }
        });

        if (apiKey) {
            await this.setApiKey(context, provider, apiKey.trim());
            vscode.window.showInformationMessage(`${providerName} API key configured successfully!`);
            return true;
        }

        return false;
    }

    /**
     * Show configuration instructions to user
     */
    static showConfigurationInstructions(): void {
        const message = `FastCommit requires an API key to generate commit messages. Please configure:

1. Go to VS Code Settings (Cmd/Ctrl + ,)
2. Search for "FastCommit"
3. Select your preferred API provider
4. Run "FastCommit: Configure API Key" from Command Palette

Supported providers:
• OpenAI (GPT models) - Get key from https://platform.openai.com
• Anthropic (Claude models) - Get key from https://console.anthropic.com
• OpenRouter (Multiple providers) - Get key from https://openrouter.ai`;

        vscode.window.showInformationMessage(message, 'Open Settings', 'Configure API Key')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'fastcommit');
                } else if (selection === 'Configure API Key') {
                    vscode.commands.executeCommand('fastcommit.configureApiKey');
                }
            });
    }

    /**
     * Validate current configuration
     */
    static async validateConfiguration(context: vscode.ExtensionContext): Promise<{ valid: boolean; error?: string }> {
        try {
            await this.getCompleteConfiguration(context);
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Unknown configuration error'
            };
        }
    }

    /**
     * Get user-friendly provider name
     */
    static getProviderDisplayName(provider: string): string {
        switch (provider) {
            case 'openai': return 'OpenAI';
            case 'anthropic': return 'Anthropic';
            case 'openrouter': return 'OpenRouter';
            default: return provider;
        }
    }
}