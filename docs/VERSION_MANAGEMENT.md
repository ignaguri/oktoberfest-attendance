# Version Management System

This document describes the automated version management system for the Oktoberfest Attendance app.

## Overview

The system provides automated version bumping, changelog generation, and release management using:
- **Version Script**: Node.js script for version management
- **Husky Hooks**: Pre-commit and commit-msg validation
- **GitHub Actions**: Automated release workflow
- **Conventional Commits**: Standardized commit message format

## Quick Start

### Version Commands

```bash
# Show current version
pnpm run version:show

# Bump versions
pnpm run version:patch    # 0.3.0 → 0.3.1
pnpm run version:minor    # 0.3.1 → 0.4.0
pnpm run version:major    # 0.4.0 → 1.0.0

# Set specific version
pnpm run version:set 1.2.3

# Quick release (bump + commit + tag)
pnpm run release:patch
pnpm run release:minor
pnpm run release:major
```

### Manual Version Management

```bash
# Using the script directly
node scripts/version.js patch
node scripts/version.js minor
node scripts/version.js major
node scripts/version.js set 1.2.3
```

## Conventional Commits

All commits must follow the conventional commit format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

- **feat**: New features (appears in in-app changelog)
- **fix**: Bug fixes (appears in in-app changelog)
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependencies, etc.
- **breaking**: Breaking changes (requires detailed description)

### Examples

```bash
# Good examples
git commit -m "feat: add new leaderboard feature"
git commit -m "fix(auth): resolve login issue"
git commit -m "docs: update README with new features"
git commit -m "style: format code with prettier"
git commit -m "refactor: restructure component logic"
git commit -m "perf: optimize image loading"
git commit -m "test: add unit tests for utils"
git commit -m "chore: update dependencies"

# Breaking changes require detailed description
git commit -m "breaking: remove deprecated API

This change removes the old API endpoints that were deprecated in v0.3.0.
Users should migrate to the new endpoints documented in the API guide.

Migration guide:
- Replace /api/old with /api/new
- Update request format to match new schema"
```

## Pre-commit Hooks

### Pre-commit Hook
- Runs TypeScript type checking
- Ensures code compiles before commit

### Commit-msg Hook
- Validates conventional commit format
- Enforces commit message length limits
- Requires detailed descriptions for breaking changes

## Changelog Generation

The system generates two types of changelogs:

### 1. In-App Changelog (`changelog.ts`)
- **Only includes `feat` commits**
- Used by the `WhatsNew` component
- Shows user-facing changes only
- Automatically filtered and formatted

### 2. Repository Changelog (`CHANGELOG.md`)
- **Includes ALL commit types**
- Comprehensive development history
- Used for GitHub releases
- Categorized by commit type

## GitHub Actions Workflow

### Automatic Release
- Triggered by pushing a version tag (`v*`)
- Generates changelogs
- Builds the application
- Creates GitHub release with assets

### Manual Release
- Can be triggered manually from GitHub Actions
- Supports version bumping and release creation

## File Structure

```
scripts/
├── version.js              # Version management script

.husky/
├── pre-commit             # Pre-commit validation
└── commit-msg             # Commit message validation

.github/workflows/
└── release.yml            # Release automation

docs/
└── VERSION_MANAGEMENT.md  # This documentation
```

## Configuration

### Package.json Scripts

```json
{
  "scripts": {
    "version:show": "node scripts/version.js show",
    "version:patch": "node scripts/version.js patch",
    "version:minor": "node scripts/version.js minor",
    "version:major": "node scripts/version.js major",
    "version:set": "node scripts/version.js set",
    "release:patch": "pnpm run version:patch && git add . && git commit -m \"chore: bump version\" && git tag v$(node scripts/version.js show) && git push && git push --tags",
    "release:minor": "pnpm run version:minor && git add . && git commit -m \"chore: bump version\" && git tag v$(node scripts/version.js show) && git push && git push --tags",
    "release:major": "pnpm run version:major && git add . && git commit -m \"chore: bump version\" && git tag v$(node scripts/version.js show) && git push && git push --tags",
    "prepare": "husky"
  }
}
```

### Husky Configuration

```json
{
  "devDependencies": {
    "husky": "^9.0.0"
  },
  "scripts": {
    "prepare": "husky"
  }
}
```

## Workflow

### Daily Development
1. Make changes following conventional commit format
2. Pre-commit hooks validate code quality
3. Commit-msg hook validates commit format
4. Push changes to feature branch

### Release Process
1. **Option 1**: Use quick release commands
   ```bash
   pnpm run release:minor  # Creates v0.4.0
   ```

2. **Option 2**: Manual process
   ```bash
   pnpm run version:minor
   git add .
   git commit -m "chore: bump version to 0.4.0"
   git tag v0.4.0
   git push && git push --tags
   ```

3. **GitHub Actions** automatically:
   - Generates changelogs
   - Builds the application
   - Creates release with assets

## Troubleshooting

### Common Issues

#### Husky Hooks Not Working
```bash
# Reinstall husky
pnpm run prepare

# Check git hooks path
git config core.hooksPath
# Should show: .husky
```

#### Version Script Errors
```bash
# Check script permissions
chmod +x scripts/version.js

# Verify Node.js version
node --version  # Should be 18+
```

#### Conventional Commit Validation Fails
- Ensure commit message follows format: `type: description`
- Check message length (max 72 characters for first line)
- For breaking changes, add detailed description in body

### Reset Version
```bash
# Reset to specific version
pnpm run version:set 0.3.0

# Or manually edit version.ts and package.json
```

## Best Practices

1. **Always use conventional commits** - even for small changes
2. **Keep commit messages concise** but descriptive
3. **Use scopes** when changes affect specific areas
4. **Test version scripts** before major releases
5. **Review generated changelogs** before pushing tags
6. **Use quick release commands** for standard version bumps
7. **Document breaking changes** thoroughly

## Migration from Manual Versioning

If you're migrating from manual version management:

1. **Backup current version files**
2. **Install husky**: `pnpm add -D husky`
3. **Run prepare**: `pnpm run prepare`
4. **Test the system** with a patch version
5. **Update CI/CD** to use new workflow

## Support

For issues with the version management system:
1. Check this documentation
2. Review GitHub Actions logs
3. Verify husky configuration
4. Test version scripts manually
