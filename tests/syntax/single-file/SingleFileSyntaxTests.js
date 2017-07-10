const conversion = require('../../../scripts/conversion.js');
const fs = require('fs-extra');
const path = require('path');
const parse = require('../../../lib/parse');
const emit = require('../../../lib/emit');
const colors = require('colors');
const jsdiff = require('diff');

/*
  Converts all as3 files in tests/simple/as3 to typescript files in tests/simple/ts-generated
  and compares the output.

  All files are treated independently and there is no special multipass mechanism nor
  inter-relation between the transpiled files.

  TODO: ability to print diffs?
  TODO: improve naming
  TODO: support single file focusing
  TODO: support visitors
  TODO: study usage of namespaces
 */

// Configuration settings used in this script:
const focusedSourceFile = ''; // Leave empty if there is no focused file.
const sourceDirectory = path.resolve(__dirname, './as3');
const destinationDirectory = path.resolve(__dirname, 'ts-generated');
const comparisonDirectory = path.resolve(__dirname, 'ts-expected');
const emitterOptions = {
  lineSeparator: '\n'
};

// Clean target directory.
conversion.clearDirectory(destinationDirectory);

// Collect all files.
const as3Files = conversion.readdir(sourceDirectory).filter(file => /.as$/.test(file));
console.log("Running simple conversion tests on " + as3Files.length + " files...\n");

// For each as3 file, convert and test...
let passed = 0;
let diffs = [];
as3Files.forEach(file => {

  // Identify source file.
  let as3File = path.resolve(sourceDirectory, file);
  let segments = file.match(/([a-zA-Z0-9]+)/g);
  segments.pop();
  let identifier = segments.pop();

  // Identify source/target files.
  let tsFile = file.replace(/.as$/, '.ts').replace(/.snp$/, '.ts');
  let outputFile = path.resolve(destinationDirectory, tsFile);

  // Convert as3 -> ts.
  let content = fs.readFileSync(as3File, 'UTF-8');
  let ast = parse(path.basename(file), content);
  let contents = emit(ast, content, emitterOptions);

  // Write converted output.
  fs.outputFileSync(outputFile, contents.replace(/\r\n?/g, '\n'));

  // Read expected output.
  let expectedTsFile = path.resolve(comparisonDirectory, identifier + '.ts');
  if(fs.existsSync(expectedTsFile)) {
    let expectedContents = fs.readFileSync(expectedTsFile).toString();
    if(expectedContents === contents) {
      console.log(colors.green("  ✔ " + identifier + '.ts'));
      passed++;
    }
    else {
      console.log(colors.red("  ✗ " + identifier + '.ts diff failed'));
      diffs.push(jsdiff.diffLines(contents, expectedContents));
    }
  }
  else {
    console.log(colors.yellow("  ❒ WARNING: " + identifier + '.ts reference file not found'));
  }
});

console.log('\nTests passed: ' + passed + "/" + as3Files.length + "\n");

// Print diffs if present.
if(diffs.length > 0) {
  console.log("Diffs:\n");
  for(let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    diff.forEach(function(part) {
      let color = part.added ? 'green' : part.removed ? 'red' : 'grey';
      process.stderr.write(part.value[color]);
    });
    console.log();
  }
  console.log('\n');
}