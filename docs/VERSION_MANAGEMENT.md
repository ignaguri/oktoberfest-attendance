# Version Management System

This document describes how to use the automated version management system for the Oktoberfest Attendance app.

**Note:** This project uses PNPM as the package manager. All commands should use `pnpm` instead of `npm`.

## Overview

The version management system provides:
- Automated version bumping (patch, minor, major)
- Conventional commit enforcement
- Automatic changelog generation
- GitHub Actions integration
- Pre-commit hooks for quality control

## Quick Start

### Show Current Version
```bash
pnpm run version:show
```

### Bump Versions
```bash
# Patch version (0.0.x) - bug fixes
pnpm run version:patch

# Minor version (0.x.0) - new features
pnpm run version:minor

# Major version (x.0.0) - breaking changes
pnpm run version:major

# Set specific version
pnpm run version:set 1.2.3
```

### Quick Release
```bash
# Patch release
pnpm run release:patch

# Minor release
pnpm run release:minor

# Major release
pnpm run release:major
```

## Conventional Commits

All commits must follow the conventional commit format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `breaking`: Breaking changes

### Examples
```bash
git commit -m "feat: add new leaderboard feature"
git commit -m "fix(auth): resolve login issue"
git commit -m "docs: update README with new features"
git commit -m "style: format code with prettier"
git commit -m "refactor: restructure component logic"
git commit -m "perf: optimize image loading"
git commit -m "test: add unit tests for utils"
git commit -m "chore: update dependencies"
git commit -m "breaking: remove deprecated API"
```

## Pre-commit Hooks

The system includes pre-commit hooks that:
- Enforce conventional commit format
- Validate commit message length
- Ensure breaking changes have detailed descriptions

These hooks run automatically before each commit and will prevent commits that don't meet the standards.

## Changelog Generation

The system automatically generates changelog entries by:
1. Scanning conventional commits since the last release
2. Categorizing changes by type
3. Adding appropriate emojis for visual appeal
4. Updating the `changelog.ts` file

### Manual Changelog Updates
If you need to manually update the changelog, edit `changelog.ts` and follow the existing format:

```typescript
export const changelog: Record<string, string[]> = {
  "1.0.0": [
    "✨ New feature description",
    "🐛 Bug fix description",
    "📚 Documentation update",
  ],
  // ... other versions
};
```

## GitHub Actions

The system includes automated workflows for:
- Version bumping and release creation
- Changelog generation
- Release notifications

### Manual Release via GitHub
1. Go to Actions > Release Management
2. Click "Run workflow"
3. Select version type (patch, minor, major)
4. Click "Run workflow"

### Automated Release via Tags
Push a tag to trigger an automatic release:
```bash
git tag v1.2.3
git push origin v1.2.3
```

## Files Updated Automatically

When running version commands, these files are updated:
- `package.json` - version field
- `version.ts` - APP_VERSION constant
- `changelog.ts` - changelog entries

## Troubleshooting

### Pre-commit Hook Fails
If the pre-commit hook fails:
1. Check your commit message format
2. Ensure it follows conventional commit standards
3. For breaking changes, add a detailed description in the commit body

### Version Script Errors
If the version script fails:
1. Ensure you're in the project root directory
2. Check that all required files exist
3. Verify Git is properly configured
4. Ensure you're using PNPM commands (not npm)

### Changelog Generation Issues
If changelog generation fails:
1. Ensure you have Git tags for previous releases
2. Check that commits follow conventional format
3. Verify the changelog.ts file is writable

## Best Practices

1. **Always use conventional commits** - This ensures proper changelog generation
2. **Tag releases** - Create Git tags for each release
3. **Review changelog** - Check generated changelog entries before releasing
4. **Use appropriate version types** - Don't bump major version for minor changes
5. **Test before releasing** - Ensure the app works with the new version

## Integration with App Updates

The version management system integrates with the app update detection:
- Service worker checks `/api/version` endpoint
- React hook manages update state
- Update notifications show changelog information
- Users can see what's new before updating

This creates a seamless experience from development to deployment to user updates.
