# FastCommit

AI-powered commit message generator for VS Code that creates conventional commit messages based on your staged changes.

## Features

- 🤖 **AI-Powered**: Uses OpenAI, Anthropic, or OpenRouter to generate intelligent commit messages
- 📝 **Conventional Commits**: Follows the conventional commit specification automatically
- 🎯 **Context-Aware**: Analyzes your actual code changes to create relevant messages
- ⚡ **Quick & Easy**: One-click commit message generation from the Source Control panel
- 🔧 **Configurable**: Customize templates, exclude patterns, and provider settings
- 🔒 **Secure**: API keys stored securely in VS Code's secret storage

## Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Configure your API key**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run `FastCommit: Configure API Key`
   - Enter your API key for your preferred provider
3. **Generate commit messages**:
   - Stage your changes in Git
   - Click the FastCommit button in the Source Control panel
   - Or run `FastCommit: Generate Commit Message` from Command Palette

## Supported AI Providers

### OpenAI
- Models: GPT-5, GPT-5-mini, and other chat models
- Get API key: [OpenAI Platform](https://platform.openai.com/api-keys)

### Anthropic
- Models: Claude 4 Sonnet, Claude 4 Opus, and other Claude models
- Get API key: [Anthropic Console](https://console.anthropic.com/)

### OpenRouter
- Access to multiple AI providers through one API
- Models: Claude, GPT, Qwen, and many others
- Get API key: [OpenRouter](https://openrouter.ai/keys)

## Configuration

### Settings

Open VS Code Settings (`Ctrl+,` / `Cmd+,`) and search for "FastCommit":

- **API Provider**: Choose between OpenAI, Anthropic, or OpenRouter
- **Model**: Specify the model to use (optional, uses provider defaults)
- **Custom Template**: Override the default conventional commit template
- **Include Unstaged**: Generate messages from unstaged changes if no staged changes exist
- **Exclude Lock Files**: Skip package manager lock files from analysis

### API Keys

API keys are stored securely in VS Code's secret storage:

```bash
# Configure via Command Palette
FastCommit: Configure API Key
```

### Example .gitignore

Create a `.gitignore` file in your project root to exclude specific files:

```
# Ignore build artifacts
dist/
build/
*.log

# Ignore documentation
docs/
README.md

# Ignore test files
**/*.test.js
**/*.spec.ts
```

## How It Works

1. **Analyzes Changes**: FastCommit examines your staged Git changes
2. **Generates Context**: Creates a comprehensive diff and repository context
3. **AI Processing**: Sends context to your chosen AI provider
4. **Formats Output**: Ensures the response follows conventional commit standards
5. **Sets Message**: Automatically populates the Git commit message field

## Conventional Commit Format

FastCommit generates messages following the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Common Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

### Example Messages

```bash
feat(auth): add OAuth2 login integration

fix: resolve memory leak in data processing

docs: update API documentation for v2.0

refactor(utils): extract common validation logic
```

## Troubleshooting

### No Changes Found
- Ensure you have staged changes: `git add .`
- Check that you're in a Git repository
- Verify the repository is recognized by VS Code's Git extension

### API Key Issues
- Verify your API key is correct and active
- Check that you have sufficient credits/quota
- Ensure you're using the right provider setting

### No Git Extension
- Enable VS Code's built-in Git extension
- Restart VS Code if Git extension was recently installed

## Privacy & Security

- API keys are stored locally in VS Code's encrypted secret storage
- Code diffs are sent to your chosen AI provider for analysis
- No data is stored or logged by the FastCommit extension
- All communication uses HTTPS encryption

## Contributing

FastCommit is open source! Contributions welcome:

- Report bugs and request features
- Submit pull requests
- Share feedback and suggestions

## License

MIT License - see LICENSE file for details.

## Changelog

### 1.0.0
- Initial release
- Support for OpenAI, Anthropic, and OpenRouter
- Conventional commit message generation
- VS Code Git integration
- Configurable templates and exclusions