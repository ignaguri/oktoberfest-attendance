#!/usr/bin/env tsx

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

import { formatDateForDatabase } from "../lib/date-utils";

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");
const CHANGELOG_MD_PATH = path.join(__dirname, "..", "CHANGELOG.md");

// Types
interface PackageJson {
  version: string;
  [key: string]: any;
}

// Get current version from package.json
function getCurrentVersion(): string {
  const packageJson: PackageJson = JSON.parse(
    fs.readFileSync(PACKAGE_JSON_PATH, "utf8"),
  );
  return packageJson.version;
}

// Update version in package.json
function updatePackageJson(newVersion: string): void {
  const packageJson: PackageJson = JSON.parse(
    fs.readFileSync(PACKAGE_JSON_PATH, "utf8"),
  );
  packageJson.version = newVersion;
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  console.log(`✅ Updated package.json to version ${newVersion}`);
}

// Update version.ts is no longer needed - version comes from package.json
function updateVersionTs(newVersion: string): void {
  console.log(
    `ℹ️  Version ${newVersion} will be available at build time from package.json`,
  );
}

// Helper function to get commit type emoji
function getCommitTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    feat: "✨",
    fix: "🐛",
    docs: "📚",
    style: "🎨",
    refactor: "♻️",
    perf: "⚡",
    test: "🧪",
    chore: "🔧",
    breaking: "💥",
  };
  return emojiMap[type] || "🔧";
}

// Helper function to get proper commit type display label
function getCommitTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    feat: "Features",
    fix: "Bug Fixes",
    docs: "Documentation",
    style: "Styling",
    refactor: "Code Refactoring",
    perf: "Performance Improvements",
    test: "Testing",
    chore: "Maintenance",
    breaking: "Breaking Changes",
  };
  return labelMap[type] || "Other Changes";
}

// Helper function to get commits since last tag
function getCommitsSinceLastTag(): string[] {
  const lastTag = execSync("git describe --tags --abbrev=0", {
    encoding: "utf8",
  }).trim();
  return execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

// Generate repository changelog (CHANGELOG.md) with all commit types
function generateRepositoryChangelog(newVersion: string): number {
  try {
    const commits = getCommitsSinceLastTag();
    const commitsByType: Record<string, string[]> = {
      feat: [],
      fix: [],
      docs: [],
      style: [],
      refactor: [],
      perf: [],
      test: [],
      chore: [],
      breaking: [],
    };

    commits.forEach((commit) => {
      if (
        commit.match(
          /^(feat|fix|docs|style|refactor|perf|test|chore|breaking):/,
        )
      ) {
        const type = commit.match(/^(\w+):/)?.[1];
        if (type && commitsByType[type]) {
          const description = commit.replace(/^\w+:\s*/, "");
          commitsByType[type].push(description);
        }
      }
    });

    // Generate markdown content
    let changelogContent = "";
    const date = formatDateForDatabase(new Date());
    changelogContent += `## [${newVersion}] - ${date}\n\n`;

    Object.entries(commitsByType).forEach(([type, commits]) => {
      if (commits.length > 0) {
        const emoji = getCommitTypeEmoji(type);
        const typeLabel = getCommitTypeLabel(type);
        changelogContent += `### ${emoji} ${typeLabel}\n\n`;
        commits.forEach((commit) => {
          changelogContent += `- ${commit}\n`;
        });
        changelogContent += "\n";
      }
    });

    // Read existing CHANGELOG.md or create header
    let existingContent = "";
    try {
      existingContent = fs.readFileSync(CHANGELOG_MD_PATH, "utf8");
      // Remove the header if it exists to avoid duplication
      existingContent = existingContent.replace(/^# Changelog\n\n/, "");
    } catch (error) {
      // File doesn't exist, will create new one
    }

    // Combine new and existing content
    const fullContent = `# Changelog\n\n${changelogContent}${existingContent}`;
    fs.writeFileSync(CHANGELOG_MD_PATH, fullContent);

    const totalCommits = Object.values(commitsByType).flat().length;
    console.log(`✅ Updated CHANGELOG.md with ${totalCommits} new entries`);

    return totalCommits;
  } catch (error) {
    console.log(
      "⚠️  Could not generate CHANGELOG.md:",
      error instanceof Error ? error.message : String(error),
    );
    return 0;
  }
}

// Main function
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  if (!command) {
    console.log("Usage: tsx scripts/version.ts <command> [version]");
    console.log("");
    console.log("Commands:");
    console.log("  patch     Bump patch version (0.0.x)");
    console.log("  minor     Bump minor version (0.x.0)");
    console.log("  major     Bump major version (x.0.0)");
    console.log("  set       Set specific version (e.g., 1.2.3)");
    console.log("  show      Show current version");
    console.log("");
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  let newVersion = currentVersion;

  switch (command) {
    case "patch":
      const [major, minor, patch] = currentVersion.split(".").map(Number);
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case "minor":
      const [major2, minor2] = currentVersion.split(".").map(Number);
      newVersion = `${major2}.${minor2 + 1}.0`;
      break;
    case "major":
      const [major3] = currentVersion.split(".").map(Number);
      newVersion = `${major3 + 1}.0.0`;
      break;
    case "set":
      if (!version) {
        console.error("❌ Version required for set command");
        process.exit(1);
      }
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        console.error(
          "❌ Invalid version format. Use semantic versioning (e.g., 1.2.3)",
        );
        process.exit(1);
      }
      newVersion = version;
      break;
    case "show":
      console.log(currentVersion);
      return;
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }

  console.log(`🔄 Updating version from ${currentVersion} to ${newVersion}`);

  // Update files
  updatePackageJson(newVersion);
  updateVersionTs(newVersion);

  // Generate repository changelog (markdown)
  const repoChanges = generateRepositoryChangelog(newVersion);

  console.log("");
  console.log(`🎉 Version updated to ${newVersion}!`);
  console.log(`📝 Repository changelog entries: ${repoChanges}`);
  console.log(`📱 In-app changelog (changelog.ts): Manual editing required`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Manually update changelog.ts with new features for the app");
  console.log("2. Review the changes");
  console.log(
    `3. Commit the changes: git add . && git commit -m "chore: bump version to ${newVersion}"`,
  );
  console.log(`4. Create a tag: git tag v${newVersion}`);
  console.log("5. Push: git push && git push --tags");
  console.log("");
  console.log("Or use the quick release command:");
  if (command === "set") {
    console.log("  pnpm run release:patch");
  } else {
    console.log(`  pnpm run release:${command}`);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
  generateRepositoryChangelog,
  getCurrentVersion,
  updatePackageJson,
  updateVersionTs,
};
