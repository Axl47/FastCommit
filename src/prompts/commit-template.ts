/**
 * Commit message prompt template for QuickCommit
 * Based on conventional commits specification
 */

export interface PromptParams {
    gitContext: string;
    customInstructions?: string;
    previousMessage?: string;
}

/**
 * Create prompt with template substitution
 */
function createPrompt(template: string, params: PromptParams): string {
    return template.replace(/\${(.*?)}/g, (_, key) => {
        const value = params[key as keyof PromptParams];
        return typeof value === 'string' ? value : '';
    });
}

/**
 * Default conventional commit message template
 */
const DEFAULT_COMMIT_TEMPLATE = `# Conventional Commit Message Generator

## System Instructions
You are an expert Git commit message generator that creates conventional commit messages based on staged changes. Analyze the provided git diff output and generate appropriate conventional commit messages following the specification.

\${customInstructions}

## CRITICAL: Commit Message Output Rules
- Generate ONLY a clean conventional commit message
- DO NOT include any explanatory text, formatting, or additional commentary
- Return ONLY the commit message itself

\${gitContext}

## Conventional Commits Format
Generate commit messages following this exact structure:
\`\`\`
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]
\`\`\`

### Core Types (Required)
- **feat**: New feature or functionality (MINOR version bump)
- **fix**: Bug fix or error correction (PATCH version bump)

### Additional Types (Extended)
- **docs**: Documentation changes only
- **style**: Code style changes (whitespace, formatting, semicolons, etc.)
- **refactor**: Code refactoring without feature changes or bug fixes
- **perf**: Performance improvements
- **test**: Adding or fixing tests
- **build**: Build system or external dependency changes
- **ci**: CI/CD configuration changes
- **chore**: Maintenance tasks, tooling changes
- **revert**: Reverting previous commits

### Scope Guidelines
- Use parentheses: \`feat(api):\`, \`fix(ui):\`
- Common scopes: \`api\`, \`ui\`, \`auth\`, \`db\`, \`config\`, \`deps\`, \`docs\`
- For monorepos: package or module names
- Keep scope concise and lowercase

### Description Rules
- Use imperative mood ("add" not "added" or "adds")
- Start with lowercase letter
- No period at the end
- Maximum 50 characters
- Be concise but descriptive

### Body Guidelines (Optional)
- Start one blank line after description
- Explain the "what" and "why", not the "how"
- Wrap at 72 characters per line
- Use for complex changes requiring explanation

### Footer Guidelines (Optional)
- Start one blank line after body
- **Breaking Changes**: \`BREAKING CHANGE: description\`

## Analysis Instructions
When analyzing staged changes:
1. Determine Primary Type based on the nature of changes
2. Identify Scope from modified directories or modules
3. Craft Description focusing on the most significant change
4. Determine if there are Breaking Changes
5. For complex changes, include a detailed body explaining what and why
6. Add appropriate footers for issue references or breaking changes

For significant changes, include a detailed body explaining the changes.

Return ONLY the commit message in the conventional format, nothing else.`;

/**
 * Template for generating a different commit message when called repeatedly
 */
const DIFFERENT_MESSAGE_TEMPLATE = `# CRITICAL INSTRUCTION: GENERATE A COMPLETELY DIFFERENT COMMIT MESSAGE
The user has requested a new commit message for the same changes.
The previous message was: "\${previousMessage}"
YOU MUST create a message that is COMPLETELY DIFFERENT by:
- Using entirely different wording and phrasing
- Focusing on different aspects of the changes
- Using a different structure or format if appropriate
- Possibly using a different type or scope if justifiable
This is the MOST IMPORTANT requirement for this task.

` + DEFAULT_COMMIT_TEMPLATE + `

FINAL REMINDER: Your message MUST be COMPLETELY DIFFERENT from the previous message: "\${previousMessage}". This is a critical requirement.`;

/**
 * Generate commit message prompt based on context and options
 */
export function createCommitMessagePrompt(params: PromptParams): string {
    const template = params.previousMessage ? DIFFERENT_MESSAGE_TEMPLATE : DEFAULT_COMMIT_TEMPLATE;
    return createPrompt(template, params);
}

/**
 * Extract commit message from AI response by cleaning up formatting
 */
export function extractCommitMessage(response: string): string {
    // Clean up the response by removing any extra whitespace or formatting
    const cleaned = response.trim();

    // Remove any code block markers
    const withoutCodeBlocks = cleaned.replace(/```[a-z]*\n|```/g, '');

    // Remove any quotes or backticks that might wrap the message
    const withoutQuotes = withoutCodeBlocks.replace(/^["'`]|["'`]$/g, '');

    // Remove any leading/trailing markdown or formatting
    const withoutMarkdown = withoutQuotes.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');

    return withoutMarkdown.trim();
}

/**
 * Get default model configurations for different providers
 */
export function getDefaultModelConfig(provider: string): { model: string; temperature: number; maxTokens: number } {
    switch (provider) {
        case 'openai':
            return {
                model: 'gpt-5-mini',
                temperature: 1,
                maxTokens: 500
            };
        case 'anthropic':
            return {
                model: 'claude-4-sonnet',
                temperature: 1,
                maxTokens: 500
            };
        case 'openrouter':
            return {
                model: 'anthropic/claude-4-sonnet',
                temperature: 1,
                maxTokens: 500
            };
        default:
            return {
                model: 'gpt-5-mini',
                temperature: 1,
                maxTokens: 500
            };
    }
}