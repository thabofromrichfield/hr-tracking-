import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmployeeFieldsFromOcrText,
  parseFlexibleDate,
  parseSouthAfricanId,
} from '../src/lib/employee-ocr.ts';
import { departments, initialBranches } from '../src/data.ts';

test('parseSouthAfricanId extracts 13-digit SA ID and derives ISO date of birth', () => {
  const res = parseSouthAfricanId('Identity Number: 940812 5800 087');
  assert.deepEqual(res, {
    idNumber: '9408125800087',
    dob: '1994-08-12',
  });
});

test('parseFlexibleDate handles ISO, DMY words, and SA numeric dates', () => {
  assert.equal(parseFlexibleDate('12 AUG 1994'), '1994-08-12');
  assert.equal(parseFlexibleDate('05/11/2026'), '2026-11-05');
  assert.equal(parseFlexibleDate('2026-03-15'), '2026-03-15');
});

test('SA Smart ID Card scan fills personal ID fields and flags employment & about blocks as allMissing', () => {
  const smartIdOcr = `
    REPUBLIC OF SOUTH AFRICA
    NATIONAL IDENTITY CARD
    Surname:
    MOYO
    Names:
    THANDI GRACE
    Sex: F
    Nationality: RSA
    Identity Number:
    940812 0452 083
    Date of Birth:
    12 AUG 1994
  `;

  const extracted = extractEmployeeFieldsFromOcrText(smartIdOcr, {
    branches: initialBranches,
    departments,
    customFields: [],
  });

  assert.equal(extracted.values.fullName, 'Thandi Grace Moyo');
  assert.equal(extracted.values.idNumber, '9408120452083');
  assert.equal(extracted.values.dob, '1994-08-12');

  assert.ok(extracted.filledFields.includes('fullName'));
  assert.ok(extracted.filledFields.includes('idNumber'));
  assert.ok(extracted.filledFields.includes('dob'));
  assert.ok(extracted.missingFields.includes('email'));
  assert.ok(extracted.missingFields.includes('jobTitle'));

  assert.equal(extracted.blocks.personal.allMissing, false);
  assert.equal(extracted.blocks.personal.filledCount, 3);
  assert.equal(extracted.blocks.employment.allMissing, true);
  assert.equal(extracted.blocks.about.allMissing, true);
});

test('HR Registration Form scan populates personal, employment, branch, salary, and custom fields', () => {
  const hrSheetOcr = `
    EMPLOYEE REGISTRATION FORM
    Full Name: Kabelo Sithole
    Employee No: PF-1042
    ID Number: 9104225123081
    Email: kabelo.sithole@company.co.za
    Contact Number: +27 82 345 6789
    Home Address: 44 Rivonia Road, Sandton, Johannesburg
    Emergency Contact: Nomsa Sithole - 083 987 6543
    Job Title: Senior Operations Coordinator
    Department: Operations
    Reports To: Lerato Molefe
    Employment Type: Full-time
    Start Date: 01/11/2026
    Branch: Joburg
    Monthly Salary: R 38,500.00
    Skills: Logistics, Fleet Scheduling, Excel
    Languages: English, isiZulu, Sesotho
    T-shirt size: Large
  `;

  const extracted = extractEmployeeFieldsFromOcrText(hrSheetOcr, {
    branches: initialBranches,
    departments,
    customFields: [{ id: 'cf-1', label: 'T-shirt size', type: 'Text' }],
  });

  assert.equal(extracted.values.fullName, 'Kabelo Sithole');
  assert.equal(extracted.values.employeeNumber, 'PF-1042');
  assert.equal(extracted.values.idNumber, '9104225123081');
  assert.equal(extracted.values.dob, '1991-04-22');
  assert.equal(extracted.values.email, 'kabelo.sithole@company.co.za');
  assert.equal(extracted.values.phone, '+27 82 345 6789');
  assert.equal(extracted.values.emergencyName, 'Nomsa Sithole');
  assert.equal(extracted.values.emergencyPhone, '083 987 6543');
  assert.equal(extracted.values.jobTitle, 'Senior Operations Coordinator');
  assert.equal(extracted.values.department, 'Operations');
  assert.equal(extracted.values.manager, 'Lerato Molefe');
  assert.equal(extracted.values.employmentType, 'Full-time');
  assert.equal(extracted.values.startDate, '2026-11-01');
  assert.equal(extracted.values.branchId, 'br-joburg');
  assert.equal(extracted.values.monthlySalary, 38500);
  assert.equal(extracted.values.skills, 'Logistics, Fleet Scheduling, Excel');
  assert.equal(extracted.values.languages, 'English, isiZulu, Sesotho');
  assert.equal(extracted.values.custom?.['T-shirt size'], 'Large');
  assert.equal(extracted.blocks.employment.allMissing, false);
  assert.equal(extracted.blocks.about.allMissing, false);
});
