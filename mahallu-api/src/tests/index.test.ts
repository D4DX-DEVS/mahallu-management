/**
 * Aggregator entry point for `npm test`.
 *
 * node:test's directory auto-discovery only recognizes .js/.mjs/.cjs files,
 * so .ts test files must be passed as explicit args - and npm runs scripts
 * via cmd.exe on Windows, which doesn't expand `*.test.ts` globs the way a
 * POSIX shell would. Importing every suite here sidesteps both problems:
 * one explicit, cross-platform entry file.
 */
import './accountNumber.test';
import './annualReport.test';
import './assistant.test';
import './attendance.test';
import './authAccountSwitch.test';
import './bulkImport.test';
import './categories.test';
import './cemetery.test';
import './counselling.test';
import './development.test';
import './developmentIndex.test';
import './employment.test';
import './health.test';
import './impersonation.test';
import './inputValidation.test';
import './instituteAccess.test';
import './khutbah.test';
import './library.test';
import './loginRoleSelection.test';
import './madrasa.test';
import './marriageAssistance.test';
import './memberNikahGroomName.test';
import './multiRoleEndToEnd.test';
import './phaseA.test';
import './programEvents.test';
import './qard.test';
import './scholarship.test';
import './registrationStatusValidation.test';
import './security.test';
import './tenantIsolation.test';
import './tenantUpdate.test';
import './userPhoneChange.test';
import './volunteers.test';
import './zakat.test';
