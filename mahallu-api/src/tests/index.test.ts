/**
 * Aggregator entry point for `npm test`.
 *
 * node:test's directory auto-discovery only recognizes .js/.mjs/.cjs files,
 * so .ts test files must be passed as explicit args - and npm runs scripts
 * via cmd.exe on Windows, which doesn't expand `*.test.ts` globs the way a
 * POSIX shell would. Importing every suite here sidesteps both problems:
 * one explicit, cross-platform entry file.
 */
import './annualReport.test';
import './assistant.test';
import './attendance.test';
import './bulkImport.test';
import './cemetery.test';
import './counselling.test';
import './development.test';
import './developmentIndex.test';
import './employment.test';
import './health.test';
import './khutbah.test';
import './library.test';
import './madrasa.test';
import './marriageAssistance.test';
import './phaseA.test';
import './programEvents.test';
import './qard.test';
import './scholarship.test';
import './security.test';
import './volunteers.test';
import './zakat.test';
