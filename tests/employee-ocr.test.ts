import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPLOYMENT_FIELD_KEYS,
  extractEmployeeFieldsFromOcrText,
  parseFlexibleDate,
  parseSouthAfricanId,
  PRIORITY_OCR_FIELDS,
} from '../src/lib/employee-ocr.ts';
import { initialBranches } from '../src/data.ts';

test('parseSouthAfricanId heals OCR O/I/l digit noise and derives ISO date of birth', () => {
  const res = parseSouthAfricanId('Identity Number: 94O812 58OO O87');
  assert.deepEqual(res, {
    idNumber: '9408125800087',
    dob: '1994-08-12',
  });
});

test('parseFlexibleDate handles ISO, DMY words, ordinals, and SA numeric dates', () => {
  assert.equal(parseFlexibleDate('12 AUG 1994'), '1994-08-12');
  assert.equal(parseFlexibleDate('15th March 2026'), '2026-03-15');
  assert.equal(parseFlexibleDate('05/11/2026'), '2026-11-05');
  assert.equal(parseFlexibleDate('2026-03-15'), '2026-03-15');
});

test('EMPLOYMENT_FIELD_KEYS excludes department and PRIORITY_OCR_FIELDS lists all 8 core fields', () => {
  assert.equal(EMPLOYMENT_FIELD_KEYS.includes('department'), false);
  assert.deepEqual(
    PRIORITY_OCR_FIELDS.map(f => f.key),
    [
      'idNumber',
      'phone',
      'dob',
      'fullName',
      'email',
      'address',
      'jobTitle',
      'startDate',
    ]
  );
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
    customFields: [],
  });

  assert.equal(extracted.values.fullName, 'Thandi Grace Moyo');
  assert.equal(extracted.values.idNumber, '9408120452083');
  assert.equal(extracted.values.dob, '1994-08-12');

  assert.deepEqual(extracted.priorityFound.sort(), [
    'Date of birth',
    'Full name',
    'ID number',
  ]);
  assert.ok(extracted.priorityMissing.includes('Contact number'));
  assert.ok(extracted.priorityMissing.includes('Email address'));
  assert.ok(extracted.priorityMissing.includes('Home address'));
  assert.ok(extracted.priorityMissing.includes('Job title'));
  assert.ok(extracted.priorityMissing.includes('Start date'));

  assert.equal(extracted.blocks.personal.allMissing, false);
  assert.equal(extracted.blocks.personal.filledCount, 3);
  assert.equal(extracted.blocks.employment.allMissing, true);
  assert.equal(extracted.blocks.about.allMissing, true);
});

test('Multi-column HR form with 2 fields per row captures all 8 priority fields cleanly', () => {
  const twoColumnOcr = `
    PEOPLEFLOW NEW STARTER SHEET
    Full Name: Lerato Mokoena        ID No: 920614 0184 087
    Date of Birth: 14 June 1992      Cell: 082 555 1299
    Email Address: lerato.mokoena@peopleflow.co.za    Employee No: PF-2048
    Residential Address: 42 Oxford Road, Rosebank,
    Johannesburg, 2196
    Job Title: Payroll Specialist    Start Date: 01 March 2025
    Reports To: Naledi Khumalo       Branch: Joburg
    Monthly Salary: R 42,000.00
  `;

  const extracted = extractEmployeeFieldsFromOcrText(twoColumnOcr, {
    branches: initialBranches,
    customFields: [],
  });

  assert.equal(extracted.values.fullName, 'Lerato Mokoena');
  assert.equal(extracted.values.idNumber, '9206140184087');
  assert.equal(extracted.values.dob, '1992-06-14');
  assert.equal(extracted.values.phone, '082 555 1299');
  assert.equal(extracted.values.email, 'lerato.mokoena@peopleflow.co.za');
  assert.equal(
    extracted.values.address,
    '42 Oxford Road, Rosebank, Johannesburg, 2196'
  );
  assert.equal(extracted.values.jobTitle, 'Payroll Specialist');
  assert.equal(extracted.values.startDate, '2025-03-01');
  assert.equal(extracted.priorityFound.length, 8);
  assert.equal(extracted.priorityMissing.length, 0);
});

test('Noisy camera OCR on contract/CV extracts all 8 priority fields via prose & unlabeled fallbacks', () => {
  const noisyContractCvOcr = `
    SIPHO NKOSI
    Senior HR Business Partner
    91O315 5O82 O8 4
    O73 412 889O
    sipho . nkosi @ peopleflow . co . za
    18 Rivonia Road, Sandton, 2196
    Employment Agreement: The employee is appointed as Senior HR Business Partner commencing on 15th January 2026 on a permanent basis.
    Skills: Employee Relations, Payroll, Labour Law
    Languages: English, isiZulu
    T-shirt size: Large
  `;

  const extracted = extractEmployeeFieldsFromOcrText(noisyContractCvOcr, {
    branches: initialBranches,
    customFields: [{ id: 'cf-1', label: 'T-shirt size', type: 'Text' }],
  });

  assert.equal(extracted.values.fullName, 'Sipho Nkosi');
  assert.equal(extracted.values.idNumber, '9103155082084');
  assert.equal(extracted.values.dob, '1991-03-15');
  assert.equal(extracted.values.phone, '073 412 8890');
  assert.equal(extracted.values.email, 'sipho.nkosi@peopleflow.co.za');
  assert.equal(extracted.values.address, '18 Rivonia Road, Sandton, 2196');
  assert.equal(extracted.values.jobTitle, 'Senior HR Business Partner');
  assert.equal(extracted.values.startDate, '2026-01-15');
  assert.equal(extracted.values.employmentType, 'Full-time');
  assert.equal(extracted.values.custom?.['T-shirt size'], 'Large');
  assert.equal(extracted.priorityFound.length, 8);
  assert.equal(extracted.priorityMissing.length, 0);
});
