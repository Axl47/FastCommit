import ignore, { Ignore } from 'ignore';
import { normalizePath } from './path';

// Common lock files and build artifacts that should be excluded from commit message analysis
const lockFiles: string[] = [
    // JavaScript / Node.js
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    '.yarnrc.yml',
    '.pnp.js',
    '.pnp.cjs',
    
    // Python
    'Pipfile.lock',
    'poetry.lock',
    'pdm.lock',
    '.pdm-lock.toml',
    
    // Ruby
    'Gemfile.lock',
    
    // PHP
    'composer.lock',
    
    // Java / JVM
    'gradle.lockfile',
    'dependency-lock.json',
    
    // .NET
    'packages.lock.json',
    'paket.lock',
    'project.assets.json',
    
    // Rust
    'Cargo.lock',
    
    // Go
    'go.sum',
    'Gopkg.lock',
    
    // Swift / iOS
    'Package.resolved',
    'Podfile.lock',
    'Cartfile.resolved',
    
    // Dart / Flutter
    'pubspec.lock',
    
    // Other common ones
    'mix.lock', // Elixir
    'stack.yaml.lock', // Haskell
    'shard.lock', // Crystal
    'Manifest.toml', // Julia
    'renv.lock', // R
    'conan.lock', // C/C++
    '.terraform.lock.hcl', // Terraform
    'flake.lock', // Nix
    'deno.lock' // Deno
];

let lockFileIgnoreInstance: Ignore | null = null;

function createLockFileIgnoreInstance(): Ignore {
    if (lockFileIgnoreInstance) {
        return lockFileIgnoreInstance;
    }

    const ignoreInstance = ignore();
    
    // Add lock file patterns - use glob patterns to match files in any directory
    const lockFilePatterns = lockFiles.map(file => `**/${file}`);
    ignoreInstance.add(lockFilePatterns);
    
    // Add common build/cache directories
    const directoryPatterns = [
        '**/node_modules/**',
        '**/.yarn/cache/**',
        '**/.yarn/unplugged/**',
        '**/target/debug/**',
        '**/target/release/**',
        '**/build/**',
        '**/dist/**',
        '**/__pycache__/**',
        '**/.pytest_cache/**',
        '**/vendor/**'
    ];
    ignoreInstance.add(directoryPatterns);
    
    lockFileIgnoreInstance = ignoreInstance;
    return ignoreInstance;
}

/**
 * Determines if a file should be excluded from git diffs based on lock file patterns.
 * This function specifically handles package manager lock files and build artifacts
 * that typically shouldn't be included in commit message generation.
 *
 * @param filePath - The file path to check (can be full path or just filename)
 * @returns boolean - true if the file should be excluded from git diffs
 */
export function shouldExcludeLockFile(filePath: string): boolean {
    const ignoreInstance = createLockFileIgnoreInstance();
    const normalizedPath = normalizePath(filePath);
    return ignoreInstance.ignores(normalizedPath);
}

/**
 * Get a list of all patterns that are excluded by default
 */
export function getExcludedPatterns(): string[] {
    return [
        ...lockFiles.map(file => `**/${file}`),
        '**/node_modules/**',
        '**/.yarn/cache/**',
        '**/target/debug/**',
        '**/target/release/**',
        '**/build/**',
        '**/dist/**',
        '**/__pycache__/**',
        '**/vendor/**'
    ];
}