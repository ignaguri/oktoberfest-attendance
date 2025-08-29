#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");
const VERSION_TS_PATH = path.join(__dirname, "..", "version.ts");
const CHANGELOG_TS_PATH = path.join(__dirname, "..", "changelog.ts");
const CHANGELOG_MD_PATH = path.join(__dirname, "..", "CHANGELOG.md");

// Get current version from package.json
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  return packageJson.version;
}

// Update version in package.json
function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  packageJson.version = newVersion;
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  console.log(`✅ Updated package.json to version ${newVersion}`);
}

// Update version.ts
function updateVersionTs(newVersion) {
  const content = `export const APP_VERSION = "${newVersion}";\n`;
  fs.writeFileSync(VERSION_TS_PATH, content);
  console.log(`✅ Updated version.ts to version ${newVersion}`);
}

// Helper function to safely parse existing changelog
function parseExistingChangelog() {
  try {
    const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
    const match = changelogContent.match(
      /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
    );
    if (match) {
      // Replace eval with safer JSON parsing
      const jsonString = match[1]
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
        .replace(/'/g, '"'); // Replace single quotes with double quotes
      return JSON.parse(jsonString);
    }
    return {};
  } catch (error) {
    console.log("⚠️  Could not read existing changelog, creating new one");
    return {};
  }
}

// Helper function to write changelog file
function writeChangelogFile(changelog) {
  const changelogContent = `export const changelog: Record<string, string[]> = ${JSON.stringify(changelog, null, 2)};\n`;
  fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
}

// Helper function to get commit type emoji
function getCommitTypeEmoji(type) {
  const emojiMap = {
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
function getCommitsSinceLastTag() {
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
function generateRepositoryChangelog(newVersion) {
  try {
    const commits = getCommitsSinceLastTag();
    const commitsByType = {
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
        const type = commit.match(/^(\w+):/)[1];
        const description = commit.replace(/^\w+:\s*/, "");
        if (commitsByType[type]) {
          commitsByType[type].push(description);
        }
      }
    });

    // Generate markdown content
    let changelogContent = "";
    const date = new Date().toISOString().split("T")[0];
    changelogContent += `## [${newVersion}] - ${date}\n\n`;

    const typeLabels = {
      feat: "✨ Features",
      fix: "🐛 Bug Fixes",
      docs: "📚 Documentation",
      style: "🎨 Styles",
      refactor: "♻️ Code Refactoring",
      perf: "⚡ Performance Improvements",
      test: "🧪 Tests",
      chore: "🔧 Chores",
      breaking: "💥 BREAKING CHANGES",
    };

    Object.entries(commitsByType).forEach(([type, commits]) => {
      if (commits.length > 0) {
        changelogContent += `### ${typeLabels[type]}\n\n`;
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
    console.log("⚠️  Could not generate CHANGELOG.md:", error.message);
    return 0;
  }
}

// Generate in-app changelog (only feature commits)
function generateInAppChangelog(newVersion) {
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
      .filter(Boolean);

    const existingChangelog = parseExistingChangelog();
    const mergedChangelog = {
      [newVersion]: changelogEntries,
      ...existingChangelog,
    };

    writeChangelogFile(mergedChangelog);
    console.log(
      `✅ Updated changelog.ts with ${changelogEntries.length} new entries`,
    );

    return changelogEntries;
  } catch (error) {
    console.log(
      "⚠️  Could not generate changelog.ts from commits:",
      error.message,
    );

    const defaultEntries = ["🔧 Version update"];
    const existingChangelog = parseExistingChangelog();
    const mergedChangelog = {
      [newVersion]: defaultEntries,
      ...existingChangelog,
    };

    writeChangelogFile(mergedChangelog);
    console.log(`✅ Updated changelog.ts with default entry`);
    return defaultEntries;
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  if (!command) {
    console.log("Usage: node scripts/version.js <command> [version]");
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

module.exports = {
  getCurrentVersion,
  updatePackageJson,
  updateVersionTs,
  generateRepositoryChangelog,
  generateInAppChangelog,
};
