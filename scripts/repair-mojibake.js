#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPLACEMENTS = new Map([
  ["\u00c3\u00a4", "\u00e4"], ["\u00c3\u0084", "\u00c4"], ["\u00c3\u00b6", "\u00f6"],
  ["\u00c3\u0096", "\u00d6"], ["\u00c3\u00bc", "\u00fc"], ["\u00c3\u009c", "\u00dc"],
  ["\u00c3\u009f", "\u00df"], ["\u00e2\u20ac\u201c", "\u2013"], ["\u00e2\u20ac\u201d", "\u2014"],
  ["\u00e2\u20ac\u0153", "\u201c"], ["\u00e2\u20ac\u009d", "\u201d"], ["\u00e2\u20ac\u2122", "\u2019"],
  ["\u00c2\u00b7", "\u00b7"],
]);

/**
 * Repairs known mojibake patterns in UTF-8 decoded text.
 * @param {string} text - Source text to inspect.
 * @returns {string} Text with configured repairs applied.
 */
function repairText(text) {
  let repairedText = text;
  for (const [from, to] of REPLACEMENTS) {
    repairedText = repairedText.split(from).join(to);
  }
  return repairedText;
}

/**
 * Parses the command line and rejects missing file arguments.
 * @param {string[]} argumentsList - Command-line arguments without node and script path.
 * @returns {{write: boolean, files: string[]}} Repair mode and target paths.
 */
function parseArguments(argumentsList) {
  const write = argumentsList.includes("--write");
  const files = argumentsList.filter((argument) => argument !== "--write");
  if (files.length === 0) {
    throw new Error("Usage: node scripts/repair-mojibake.js [--write] <file> [more files]");
  }
  return { write, files };
}

/**
 * Reports or writes repairs for one explicitly named text file.
 * @param {string} filePath - File to repair.
 * @param {boolean} write - Whether the repaired content may be written.
 * @returns {boolean} True when the file contains a repairable pattern.
 */
function repairFile(filePath, write) {
  const source = fs.readFileSync(filePath, "utf8");
  const repaired = repairText(source);
  if (source === repaired) {
    console.log(`${filePath}: no known mojibake patterns.`);
    return false;
  }
  if (write) {
    fs.writeFileSync(filePath, repaired, "utf8");
    console.log(`${filePath}: repaired.`);
  } else {
    console.log(`${filePath}: repair available; rerun with --write to apply.`);
  }
  return true;
}

/**
 * Runs the explicit, opt-in repair command.
 * @returns {void} Reports repairable files or applies them with --write.
 */
function main() {
  const options = parseArguments(process.argv.slice(2));
  for (const fileName of options.files) {
    repairFile(path.resolve(fileName), options.write);
  }
}

main();
