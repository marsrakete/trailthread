#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".php", ".ps1", ".svg", ".txt", ".webmanifest", ".yaml", ".yml"]);
const SKIPPED_DIRECTORIES = new Set([".git", "artifacts", "downloads", "node_modules", "snapshots"]);

/**
 * Returns whether a file is a supported text source.
 * @param {string} filePath - Absolute or relative file path.
 * @returns {boolean} True for files that should be checked.
 */
function isSupportedTextFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(extension);
}

/**
 * Collects supported text sources below a directory.
 * @param {string} directoryPath - Directory to scan.
 * @param {string[]} results - Mutable result list.
 * @returns {string[]} Collected absolute file paths.
 */
function collectTextFiles(directoryPath, results) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        collectTextFiles(fullPath, results);
      }
    } else if (entry.isFile() && isSupportedTextFile(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Calculates the one-based line and column for a character offset.
 * @param {string} text - Full UTF-8 decoded source text.
 * @param {number} offset - Zero-based character offset.
 * @returns {{line: number, column: number}} Position of the offset.
 */
function getLineAndColumn(text, offset) {
  const lines = text.slice(0, offset).split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * Finds likely mojibake caused by decoding UTF-8 as Windows-1252.
 * @param {string} text - UTF-8 decoded source text.
 * @returns {{sample: string, offset: number}|null} First suspicious occurrence or null.
 */
function findSuspiciousEncoding(text) {
  const patterns = [/\u00c3[\u0080-\u00bfA-Za-z]/u, /\u00c2[\u0080-\u00bfA-Za-z]/u, /\u00e2[\u0080-\u00bfA-Za-z]/u];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && typeof match.index === "number") {
      return { sample: match[0], offset: match.index };
    }
  }
  const replacementOffset = text.indexOf("\uFFFD");
  if (replacementOffset >= 0) {
    return { sample: "\uFFFD", offset: replacementOffset };
  }
  return null;
}

/**
 * Checks every project text source and reports suspicious encoding.
 * @returns {void} Sets a failing exit code when damaged text is found.
 */
function main() {
  const root = process.cwd();
  const findings = [];
  for (const filePath of collectTextFiles(root, [])) {
    const text = fs.readFileSync(filePath, "utf8");
    const suspicious = findSuspiciousEncoding(text);
    if (suspicious) {
      const position = getLineAndColumn(text, suspicious.offset);
      findings.push(`${path.relative(root, filePath)}:${position.line}:${position.column} suspicious encoding near "${suspicious.sample}"`);
    }
  }
  if (findings.length === 0) {
    console.log("Encoding check passed. No obvious mojibake patterns found.");
  } else {
    console.error("Encoding check found suspicious text:");
    for (const finding of findings) {
      console.error(finding);
    }
    process.exitCode = 1;
  }
}

main();
