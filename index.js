#!/usr/bin/env node

const Parser = require('tap-parser');
const fs = require('fs');
const mkdirp = require('mkdirp');

// Print help
if (process.argv.indexOf('--help') > 0 || process.argv.indexOf('-h') > 0) {
	console.log(`Tape test result reporter in Generic Test Data format.

	Usage:
	  tape test.js | tape-generic-test-data-reporter [OPTIONS]

	Options:
	  -h,         --help          Print command line options.
	  -f <file>,  --file <file>   If present, writes report to given path, otherwise prints to stdout.`.replace(/\t/g, ''));
	return;
}

// Set report path
let reportPath = '';

function setReportPath(flag) {
	const index = process.argv.indexOf(flag);
	if (process.argv[index + 1]) {
		reportPath = process.argv[index + 1];
	} else {
		throw new Error("Report path is not defined");
	}
}
if (process.argv.indexOf('--file') > 0) {
	setReportPath('--file');
}
if (process.argv.indexOf('-f') > 0) {
	setReportPath('-f');
}

// Create reporter
const p = new Parser(function parseTapReportCallback(results) {
	const reportStart = `<testExecutions version="1"><file path="noname">`;
	const reportEnd = `</file></testExecutions>`;
	const reportSuccess = (id) => `<testCase name="test ${id}" duration="0" />`;
	const reportTyped = (type, id, name, shortMessage, message) => (
		`<testCase name="test ${id}: ${name.replace(/"/g, "\\x22")}" duration="0">
			<${type} message="${shortMessage.replace(/"/g, "\\x22")}">${message}</${type}>
		</testCase>`.replace(/\t/g, '')
	);

	const list = (new Array(results.count)).join(',').split(',').map((_, id) => reportSuccess(id + 1));

	results.failures.forEach(fail => {
		const short = `operator: ${fail.diag.operator}
			expected: ${fail.diag.expected}
			actual: ${fail.diag.actual}
			at: ${fail.diag.at}
		`.replace(/\t/g, '');

		list[fail.id] = reportTyped(
			'failure',
			fail.id + 1,
			fail.name,
			short,
			short + "\n" + fail.diag.stack,
		);
	});

	const report = reportStart + list.join('') + reportEnd;

	if (reportPath) {
		const dirArr = reportPath.split('/');
		dirArr.splice(-1);
		const dir = dirArr.join('/');

		mkdirp(dir, '0777', function createGivenDirectories(mkdirError) {
			if (mkdirError) {
				process.exitCode = 1;
				return console.error('Cannot create given directories', mkdirError);
			}

			fs.closeSync(fs.openSync(reportPath, 'w'));
			fs.access(reportPath, fs.constants.W_OK, function reportFileAccessCheck(accessError) {
				if (accessError) {
					process.exitCode = 1;
					return console.error('No writing access to given file', accessError);
				}

				fs.writeFile(reportPath, report, function writeReportCallback(writeError) {
					if (writeError) {
						process.exitCode = 1;
						return console.error('Error while writing report', writeError);
					}
				});
			});
		});
	} else {
		console.log(report);
	}

	process.exitCode = results.failures.length ? 1 : 0;
});

process.stdin.pipe(p);