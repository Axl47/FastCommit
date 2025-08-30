/**
 * Simplified API handler system for FastCommit
 * Supports basic AI providers for commit message generation
 */

export interface ModelInfo {
    maxTokens?: number;
    contextWindow?: number;
    supportsImages?: boolean;
    inputCostPer1k?: number;
    outputCostPer1k?: number;
}

export interface ApiConfiguration {
    apiProvider: 'openai' | 'anthropic' | 'openrouter';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ApiHandler {
    /**
     * Generate a single completion for the given prompt
     */
    completePrompt(prompt: string): Promise<string>;
    
    /**
     * Get model information
     */
    getModel(): { id: string; info: ModelInfo };
}

/**
 * Factory function to create appropriate API handler
 */
export function createApiHandler(config: ApiConfiguration): ApiHandler {
    switch (config.apiProvider) {
        case 'openai':
            return new OpenAIHandler(config);
        case 'anthropic':
            return new AnthropicHandler(config);
        case 'openrouter':
            return new OpenRouterHandler(config);
        default:
            throw new Error(`Unsupported API provider: ${config.apiProvider}`);
    }
}

/**
 * Base API handler with common functionality
 */
abstract class BaseApiHandler implements ApiHandler {
    protected config: ApiConfiguration;

    constructor(config: ApiConfiguration) {
        this.config = config;
        this.validateConfig();
    }

    protected validateConfig(): void {
        if (!this.config.apiKey) {
            throw new Error(`API key is required for ${this.config.apiProvider}`);
        }
        if (!this.config.model) {
            throw new Error(`Model is required for ${this.config.apiProvider}`);
        }
    }

    abstract completePrompt(prompt: string): Promise<string>;
    abstract getModel(): { id: string; info: ModelInfo };

    protected async makeRequest(url: string, headers: Record<string, string>, body: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            const urlLib = require('url');
            
            const parsedUrl = urlLib.parse(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(JSON.stringify(body)),
                    ...headers
                }
            };

            const req = client.request(requestOptions, (res: any) => {
                let data = '';
                
                res.on('data', (chunk: any) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error}`));
                    }
                });
            });

            req.on('error', (error: any) => {
                reject(error);
            });

            req.write(JSON.stringify(body));
            req.end();
        });
    }
}

/**
 * OpenAI API handler
 */
class OpenAIHandler extends BaseApiHandler {
    async completePrompt(prompt: string): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is not configured');
        }

        const url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: this.config.temperature || 1,
            max_completion_tokens: this.config.maxTokens || 30000
        };

        console.log('FastCommit: Making OpenAI API request to:', url);
        console.log('FastCommit: Request model:', body.model);

        try {
            const response = await this.makeRequest(url, headers, body);
            console.log('FastCommit: Raw OpenAI API response:', JSON.stringify(response, null, 2));
            
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error(`Invalid OpenAI API response structure: ${JSON.stringify(response)}`);
            }
            
            console.log('FastCommit: Extracted commit message from OpenAI:', content);
            return content;
        } catch (error) {
            console.error('FastCommit: OpenAI API error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`OpenAI API request failed: ${errorMessage}`);
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this.config.model || 'gpt-5-mini',
            info: {
                maxTokens: 30000,
                contextWindow: 8000,
                supportsImages: false
            }
        };
    }
}

/**
 * Anthropic API handler
 */
class AnthropicHandler extends BaseApiHandler {
    async completePrompt(prompt: string): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key is not configured');
        }

        const url = this.config.baseUrl || 'https://api.anthropic.com/v1/messages';
        const headers = {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
        };

        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_completion_tokens: this.config.maxTokens || 30000,
            temperature: this.config.temperature || 1
        };

        console.log('FastCommit: Making Anthropic API request to:', url);
        console.log('FastCommit: Request model:', body.model);

        try {
            const response = await this.makeRequest(url, headers, body);
            console.log('FastCommit: Raw Anthropic API response:', JSON.stringify(response, null, 2));
            
            const content = response.content?.[0]?.text;
            if (!content) {
                throw new Error(`Invalid Anthropic API response structure: ${JSON.stringify(response)}`);
            }
            
            console.log('FastCommit: Extracted commit message from Anthropic:', content);
            return content;
        } catch (error) {
            console.error('FastCommit: Anthropic API error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Anthropic API request failed: ${errorMessage}`);
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this.config.model || 'claude-3-sonnet-20240229',
            info: {
                maxTokens: 30000,
                contextWindow: 200000,
                supportsImages: false
            }
        };
    }
}

/**
 * OpenRouter API handler
 */
class OpenRouterHandler extends BaseApiHandler {
    async completePrompt(prompt: string): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('OpenRouter API key is not configured');
        }

        const url = this.config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': 'https://github.com/fastcommit/vscode-extension',
            'X-Title': 'FastCommit VS Code Extension'
        };

        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: this.config.temperature || 1,
            max_completion_tokens: this.config.maxTokens || 30000
        };

        console.log('FastCommit: Making OpenRouter API request to:', url);
        console.log('FastCommit: Request model:', body.model);

        try {
            const response = await this.makeRequest(url, headers, body);
            console.log('FastCommit: Raw OpenRouter API response:', JSON.stringify(response, null, 2));
            
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error(`Invalid OpenRouter API response structure: ${JSON.stringify(response)}`);
            }
            
            console.log('FastCommit: Extracted commit message from OpenRouter:', content);
            return content;
        } catch (error) {
            console.error('FastCommit: OpenRouter API error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`OpenRouter API request failed: ${errorMessage}`);
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this.config.model || 'anthropic/claude-3-sonnet',
            info: {
                maxTokens: 30000,
                contextWindow: 200000,
                supportsImages: false
            }
        };
    }
}

/**
 * Simple completion handler that wraps the API handler
 */
export async function completePrompt(config: ApiConfiguration, prompt: string): Promise<string> {
    const handler = createApiHandler(config);
    return handler.completePrompt(prompt);
}