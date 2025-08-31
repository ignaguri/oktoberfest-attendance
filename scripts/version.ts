#!/usr/bin/env tsx

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");
const VERSION_TS_PATH = path.join(__dirname, "..", "version.ts");
const CHANGELOG_TS_PATH = path.join(__dirname, "..", "changelog.ts");
const CHANGELOG_MD_PATH = path.join(__dirname, "..", "CHANGELOG.md");

// Types
interface PackageJson {
  version: string;
  [key: string]: any;
}

type Changelog = Record<string, string[]>;

// Helper function to read existing changelog from file
function readExistingChangelog(): Changelog {
  try {
    const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
    const match = changelogContent.match(
      /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
    );
    if (match) {
      try {
        // Create a more robust JSON parsing approach
        let jsonString = match[1];

        // Fix array syntax: replace [ with [ and ] with ]
        jsonString = jsonString.replace(/\[/g, "[").replace(/\]/g, "]");

        // Quote unquoted keys
        jsonString = jsonString.replace(/([{,]\s*)(\w+):/g, '$1"$2":');

        // Replace single quotes with double quotes
        jsonString = jsonString.replace(/'/g, '"');

        // Handle trailing commas in arrays and objects
        jsonString = jsonString.replace(/,(\s*[}\]])/g, "$1");

        const result = JSON.parse(jsonString);
        console.debug(
          "✅ Successfully read existing changelog with",
          Object.keys(result).length,
          "versions",
        );
        return result;
      } catch (parseError) {
        console.error(
          "❌ JSON parse error:",
          parseError instanceof Error ? parseError.message : String(parseError),
        );
        console.debug("🔍 Attempting manual parsing...");

        // Fallback: try to manually extract version entries
        try {
          const versionMatches = changelogContent.matchAll(
            /"([^"]+)":\s*\[([^\]]+)\]/g,
          );
          const result: Changelog = {};
          const matches = Array.from(versionMatches);
          for (const match of matches) {
            const version = match[1];
            const entries = match[2]
              .split(",")
              .map((entry: string) => entry.trim().replace(/^["']|["']$/g, ""))
              .filter((entry: string) => entry.length > 0);
            result[version] = entries;
          }
          console.debug(
            "✅ Manual parsing successful with",
            Object.keys(result).length,
            "versions",
          );
          return result;
        } catch (manualError) {
          console.error(
            "❌ Manual parsing also failed:",
            manualError instanceof Error
              ? manualError.message
              : String(manualError),
          );
          return {};
        }
      }
    } else {
      console.error("❌ No regex match found");
      return {};
    }
  } catch (error) {
    console.error(
      "⚠️  Could not read existing changelog:",
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
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

// Update version.ts
function updateVersionTs(newVersion: string): void {
  const content = `export const APP_VERSION = "${newVersion}";\n`;
  fs.writeFileSync(VERSION_TS_PATH, content);
  console.log(`✅ Updated version.ts to version ${newVersion}`);
}

// Helper function to write changelog file
function writeChangelogFile(changelogData: Changelog): void {
  const changelogContent = `export const changelog: Record<string, string[]> = ${JSON.stringify(changelogData, null, 2)};\n`;
  fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
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
    const date = new Date().toISOString().split("T")[0];
    changelogContent += `## [${newVersion}] - ${date}\n\n`;

    Object.entries(commitsByType).forEach(([type, commits]) => {
      if (commits.length > 0) {
        const emoji = getCommitTypeEmoji(type);
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        changelogContent += `### ${emoji} ${typeLabel}s\n\n`;
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

// Generate in-app changelog (only feature commits)
function generateInAppChangelog(newVersion: string): string[] {
  try {
    const commits = getCommitsSinceLastTag();
    const featCommits = commits.filter((commit) =>
      commit.match(/^feat:\s*(.*)/),
    );
    const changelogEntries = featCommits
      .map((commit) => {
        const match = commit.match(/^feat:\s*(.*)/);
        return match ? `✨ ${match[1]}` : null;
      })
      .filter((entry): entry is string => entry !== null);

    // Read existing changelog from file instead of importing
    const existingChangelog = readExistingChangelog();

    // Only add new version if there are actual feature commits
    if (changelogEntries.length > 0) {
      const mergedChangelog: Changelog = {
        [newVersion]: changelogEntries,
        ...existingChangelog,
      };
      writeChangelogFile(mergedChangelog);
      console.log(
        `✅ Updated changelog.ts with ${changelogEntries.length} new entries`,
      );
    } else {
      // No new features, preserve existing changelog without overwriting
      console.log(
        "ℹ️  No new feature commits found, preserving existing changelog",
      );
      if (Object.keys(existingChangelog).length === 0) {
        // Only create new changelog if none exists
        const defaultEntries = ["🔧 Version update"];
        const mergedChangelog: Changelog = {
          [newVersion]: defaultEntries,
        };
        writeChangelogFile(mergedChangelog);
        console.log("✅ Created new changelog.ts with default entry");
      } else {
        console.log("✅ Existing changelog preserved");
      }
    }

    return changelogEntries;
  } catch (error) {
    console.log(
      "⚠️  Could not generate changelog.ts from commits:",
      error instanceof Error ? error.message : String(error),
    );

    // Read existing changelog from file
    const existingChangelog = readExistingChangelog();

    // Only add default entry if no existing changelog
    if (Object.keys(existingChangelog).length === 0) {
      const defaultEntries = ["🔧 Version update"];
      const mergedChangelog: Changelog = {
        [newVersion]: defaultEntries,
      };
      writeChangelogFile(mergedChangelog);
      console.log("✅ Created new changelog.ts with default entry");
      return defaultEntries;
    } else {
      console.log("✅ Existing changelog preserved");
      return [];
    }
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

  // Generate both changelogs as per documentation requirements
  const repoChanges = generateRepositoryChangelog(newVersion);
  const inAppChanges = generateInAppChangelog(newVersion);

  console.log("");
  console.log(`🎉 Version updated to ${newVersion}!`);
  console.log(`📝 Repository changelog entries: ${repoChanges}`);
  console.log(`📱 In-app changelog entries: ${inAppChanges.length}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Review the changes");
  console.log(
    `2. Commit the changes: git add . && git commit -m "chore: bump version to ${newVersion}"`,
  );
  console.log(`3. Create a tag: git tag v${newVersion}`);
  console.log("4. Push: git push && git push --tags");
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
  generateInAppChangelog,
  generateRepositoryChangelog,
  getCurrentVersion,
  updatePackageJson,
  updateVersionTs,
};
