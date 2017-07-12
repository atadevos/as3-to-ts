const conversion = require('../../scripts/conversion.js');
const fs = require('fs-extra');
const path = require('path');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const colors = require('colors');
const ts = require('typescript');

/*
 Converts all as3 files in tests/multi/as3 to typescript files in tests/multi/ts-generated
 and compares the output.

 Files are interrelated and are supposed to interact with each other.
 */

// Process incoming CLI arguments.
// ***********************************************************************
const params = conversion.processArgs(process.argv);
const showdiff = params['showdiff']; // when outputs don't match, display the lines that don't match
// ***********************************************************************

// Configuration settings used in this script:
const sourceDirectory = path.resolve(__dirname, './as3');
const sourceTempDirectory = path.resolve(__dirname, './as3-tmp');
const destinationDirectory = path.resolve(__dirname, './ts-generated');
const comparisonDirectory = path.resolve(__dirname, './ts-expected');
const emitterOptions = {
  lineSeparator: '\n',
  definitionsByNamespace: {},
  customVisitors: conversion.instantiateVisitorsFromStr(
    'trace,' +
    'dictionary,' +
    'flash-errors,' +
    'gettimer,' +
    'stringutil,' +
    'trace,' +
    'xml,' +
    'imports,' +
    'imports_toplevel,' +
    'types',
    '../lib/custom-visitors/'
  )
};

// Clean output directories.
conversion.clearDirectory(destinationDirectory);
conversion.clearDirectory(sourceTempDirectory);
console.log(colors.green("  1. Clear temp and output directories"));

// Collect all files in tmp dir and resolve includes.
conversion.collectSources([sourceDirectory], sourceTempDirectory);
console.log(colors.green("  2. Collect sources into tmp dir and resolve includes"));

// Collection namespace definitions.
console.log(colors.green("  3. Construct namespaces"));
// TODO: load external namespaces
conversion.populateNamespaces(sourceTempDirectory, emitterOptions);

// Convert all sources.
console.log(colors.green("  4. Convert sources"));
conversion.convertSources(sourceTempDirectory, destinationDirectory, emitterOptions);

// Compare output.
console.log(colors.green("  5. Compare output"));
let filesAS = conversion.readdir(destinationDirectory).filter(file => /.ts$/.test(file));
filesAS.forEach(file => {

  // Identify source file.
  let segments = file.match(/([a-zA-Z0-9]+)/g);
  segments.pop();
  let identifier = segments.pop();

  // Identify files, read them and compare them.
  let rel = path.join.apply(null, segments) + "/";
  let generatedTsFile = path.resolve(destinationDirectory, rel + identifier + '.ts');
  let expectedTsFile = path.resolve(comparisonDirectory, rel + identifier + '.ts');
  if(fs.existsSync(generatedTsFile) && fs.existsSync(expectedTsFile)) {
    let generatedContents = fs.readFileSync(generatedTsFile).toString();
    let expectedContents = fs.readFileSync(expectedTsFile).toString();
    if(generatedContents !== expectedContents) {
      console.log(colors.green("  ✗ " + identifier + '.ts ERROR: generated output does not match expected output.'));

      // Show diff?
      if(showdiff) {
        const diff = jsdiff.diffLines(contents, expectedContents);
        diff.forEach(function(part) {
          let color = part.added ? 'yellow' : part.removed ? 'red' : 'grey';
          process.stderr.write(part.value[color]);
        });
        console.log();
      }
    }
    else {
      console.log(colors.blue("    ✔ " + identifier + " diff matches"));
    }
  }
  else {
    console.log(colors.red('  ✗ ERROR: unable to find reference file to compare to.'));
  }
});

console.log(colors.green("  ⚑ Completed\n"));