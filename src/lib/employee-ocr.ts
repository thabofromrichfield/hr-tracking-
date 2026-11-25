import type {
  Branch,
  CustomField,
  Employee,
  EmploymentType,
  Status,
} from '../types.ts';

export type EmployeeFormDraft = Omit<
  Employee,
  'id' | 'lastUpdated' | 'workHistory' | 'documents'
>;

export type EmployeeBlockKey = 'personal' | 'employment' | 'about';

export interface BlockScanStatus {
  filledCount: number;
  totalCount: number;
  allMissing: boolean;
}

export interface EmployeeOcrExtraction {
  values: Partial<EmployeeFormDraft> & { custom?: Record<string, string> };
  filledFields: string[];
  missingFields: string[];
  blocks: Record<EmployeeBlockKey, BlockScanStatus>;
  rawText: string;
}

export interface OcrProgressUpdate {
  status: string;
  progress: number; // 0..100
}

export const PERSONAL_FIELD_KEYS = [
  'fullName',
  'employeeNumber',
  'idNumber',
  'dob',
  'email',
  'phone',
  'address',
  'emergencyName',
  'emergencyPhone',
] as const;

export const EMPLOYMENT_FIELD_KEYS = [
  'jobTitle',
  'department',
  'manager',
  'employmentType',
  'startDate',
  'branchId',
  'monthlySalary',
  'status',
] as const;

export const ABOUT_BASE_FIELD_KEYS = ['bio', 'skills', 'languages'] as const;

const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const SA_LANGUAGES = [
  'English',
  'isiZulu',
  'Zulu',
  'isiXhosa',
  'Xhosa',
  'Afrikaans',
  'Sesotho',
  'Southern Sotho',
  'Setswana',
  'Tswana',
  'Sepedi',
  'Northern Sotho',
  'Xitsonga',
  'Tsonga',
  'siSwati',
  'Swati',
  'Tshivenda',
  'Venda',
  'isiNdebele',
  'Ndebele',
];

const HEADER_STOPWORDS = new Set([
  'REPUBLIC',
  'SOUTH',
  'AFRICA',
  'NATIONAL',
  'IDENTITY',
  'CARD',
  'SMART',
  'DOCUMENT',
  'CURRICULUM',
  'VITAE',
  'RESUME',
  'EMPLOYMENT',
  'EMPLOYEE',
  'REGISTRATION',
  'FORM',
  'CONTRACT',
  'OFFER',
  'LETTER',
  'PERSONAL',
  'INFORMATION',
  'DETAILS',
  'PAYSLIP',
  'SALARY',
  'ADVICE',
  'PEOPLEFLOW',
  'SURNAME',
  'NAMES',
  'FORENAMES',
  'NATIONALITY',
  'CITIZENSHIP',
  'SEX',
  'SIGNATURE',
]);

function toTitleCase(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      if (!word) return '';
      if (word.length <= 2 && /^[A-Z]+$/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1920 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Parses common South African & ISO date strings into YYYY-MM-DD.
 */
export function parseFlexibleDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/[,]/g, ' ').replace(/\s+/g, ' ');
  if (!cleaned) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const iso = cleaned.match(/\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD MMM YYYY (e.g. 12 AUG 1994 or 05 November 2026)
  const dmyWords = cleaned.match(
    /\b(0?[1-9]|[12]\d|3[01])[\s/-]+([A-Za-z]{3,9})[\s/-]+(19\d{2}|20\d{2})\b/
  );
  if (dmyWords) {
    const d = Number(dmyWords[1]);
    const mStr = MONTHS[dmyWords[2].toLowerCase()];
    const y = Number(dmyWords[3]);
    if (mStr && isValidCalendarDate(y, Number(mStr), d)) {
      return `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    }
  }

  // MMM DD YYYY (e.g. Aug 12 1994)
  const mdyWords = cleaned.match(
    /\b([A-Za-z]{3,9})[\s/-]+(0?[1-9]|[12]\d|3[01])[\s/-]+(19\d{2}|20\d{2})\b/
  );
  if (mdyWords) {
    const mStr = MONTHS[mdyWords[1].toLowerCase()];
    const d = Number(mdyWords[2]);
    const y = Number(mdyWords[3]);
    if (mStr && isValidCalendarDate(y, Number(mStr), d)) {
      return `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (South African standard DMY)
  const dmyNumeric = cleaned.match(
    /\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](19\d{2}|20\d{2})\b/
  );
  if (dmyNumeric) {
    const d = Number(dmyNumeric[1]);
    const m = Number(dmyNumeric[2]);
    const y = Number(dmyNumeric[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Validates a 13-digit South African ID number (YYMMDDSSSSCAZ) and extracts DOB.
 */
export function parseSouthAfricanId(rawText: string): {
  idNumber: string;
  dob: string;
} | null {
  const candidates = rawText.matchAll(
    /(?<!\d)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[\s-]?(\d{4})[\s-]?([01]\d{2})(?!\d)/g
  );

  const currentTwoDigitYear = new Date().getFullYear() % 100;

  for (const match of candidates) {
    const digits = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}`;
    if (digits.length !== 13) continue;

    const yy = Number(match[1]);
    const mm = Number(match[2]);
    const dd = Number(match[3]);
    // Assume adult/working-age century cutoff (e.g. <= currentYear - 14 -> 2000s, else 1900s)
    const century = yy <= Math.max(0, currentTwoDigitYear - 14) ? 2000 : 1900;
    const fullYear = century + yy;

    if (!isValidCalendarDate(fullYear, mm, dd)) {
      continue;
    }

    const dob = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    return { idNumber: digits, dob };
  }

  return null;
}

function findLabeledValue(lines: string[], labelPatterns: RegExp[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of labelPatterns) {
      const inlineMatch = line.match(
        new RegExp(`^(?:${pattern.source})\\s*[:\\-–]\\s*(.+)$`, 'i')
      );
      if (inlineMatch && inlineMatch[1].trim()) {
        return inlineMatch[1].trim();
      }
      // Also support Smart ID / vertical label where label is on line i and value is on line i+1
      if (new RegExp(`^(?:${pattern.source})\\s*:?$`, 'i').test(line)) {
        const nextLine = lines[i + 1]?.trim();
        if (
          nextLine &&
          !/^[A-Za-z\s]{2,24}:$/.test(nextLine) &&
          nextLine.length <= 120
        ) {
          return nextLine;
        }
      }
    }
  }
  return null;
}

function cleanPhoneCandidate(raw: string): string | null {
  const match = raw.match(/(?:\+\d{1,3}[\s()-]*|0)(?:\d[\s()-]*){8,12}/);
  if (!match) return null;
  const compact = match[0].trim().replace(/\s+/g, ' ');
  const digitCount = compact.replace(/\D/g, '').length;
  if (digitCount < 9 || digitCount > 15) return null;
  return compact;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractEmployeeFieldsFromOcrText(
  rawText: string,
  options: {
    branches: Branch[];
    departments: string[];
    customFields: CustomField[];
  }
): EmployeeOcrExtraction {
  const normalizedText = rawText.replace(/\r\n/g, '\n');
  const lines = normalizedText
    .split('\n')
    .map(l => l.replace(/[|•·]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const values: Partial<EmployeeFormDraft> & { custom: Record<string, string> } = {
    custom: {},
  };
  const filled = new Set<string>();

  // 1. South African ID / Identity Number & DOB
  const saId = parseSouthAfricanId(normalizedText);
  const labeledId = findLabeledValue(lines, [
    /id\s*(?:number|no\.?)/,
    /identity\s*(?:number|no\.?)/,
    /passport\s*(?:number|no\.?)/,
  ]);
  if (saId) {
    values.idNumber = saId.idNumber;
    filled.add('idNumber');
    values.dob = saId.dob;
    filled.add('dob');
  } else if (labeledId) {
    const cleanedId = labeledId.replace(/[^A-Za-z0-9-]/g, '');
    if (cleanedId.length >= 6) {
      values.idNumber = cleanedId;
      filled.add('idNumber');
    }
  }

  // Explicit DOB overrides or supplements ID-derived DOB
  const labeledDob = findLabeledValue(lines, [
    /date\s*of\s*birth/,
    /birth\s*date/,
    /d\.?o\.?b\.?/,
  ]);
  if (labeledDob) {
    const parsedDob = parseFlexibleDate(labeledDob);
    if (parsedDob) {
      values.dob = parsedDob;
      filled.add('dob');
    }
  }

  // 2. Full Name (Labeled -> SA Smart ID Surname + Names -> CV Header heuristic)
  const labeledFullName = findLabeledValue(lines, [
    /full\s*name(?:s)?/,
    /employee\s*name/,
    /name\s*(?:&|and)\s*surname/,
    /candidate\s*name/,
  ]);
  const surnameVal = findLabeledValue(lines, [/surname/, /last\s*name/, /family\s*name/]);
  const forenamesVal = findLabeledValue(lines, [
    /forenames?/,
    /first\s*names?/,
    /given\s*names?/,
    /names/,
  ]);

  if (labeledFullName && /[A-Za-z]{2,}/.test(labeledFullName)) {
    values.fullName = /^[A-Z\s'-]+$/.test(labeledFullName)
      ? toTitleCase(labeledFullName)
      : labeledFullName;
    filled.add('fullName');
  } else if (surnameVal && forenamesVal) {
    const combined = `${forenamesVal} ${surnameVal}`.replace(/[^A-Za-z\s'-]/g, ' ');
    values.fullName = toTitleCase(combined);
    filled.add('fullName');
  } else {
    const plainName = findLabeledValue(lines, [/name/]);
    if (plainName && /^[A-Za-z][A-Za-z\s'-]{2,60}$/.test(plainName)) {
      values.fullName = /^[A-Z\s'-]+$/.test(plainName)
        ? toTitleCase(plainName)
        : plainName;
      filled.add('fullName');
    } else {
      // Top-of-document CV / Business card name heuristic
      for (const candidateLine of lines.slice(0, 6)) {
        if (/[@:\d]/.test(candidateLine)) continue;
        const words = candidateLine.split(/\s+/);
        if (words.length < 2 || words.length > 4) continue;
        const allAlpha = words.every(w => /^[A-Za-z'-]{2,22}$/.test(w));
        if (!allAlpha) continue;
        const hasStopword = words.some(w => HEADER_STOPWORDS.has(w.toUpperCase()));
        if (hasStopword) continue;
        values.fullName = toTitleCase(candidateLine);
        filled.add('fullName');
        break;
      }
    }
  }

  // 3. Employee Number
  const labeledEmpNo = findLabeledValue(lines, [
    /employee\s*(?:number|no\.?|id|code)/,
    /staff\s*(?:number|no\.?|id)/,
    /personnel\s*(?:number|no\.?)/,
  ]);
  const inlinePfMatch = normalizedText.match(/\b(?:PF|EMP)[-/]?\d{2,6}\b/i);
  if (labeledEmpNo && /[A-Za-z0-9]{2,20}/.test(labeledEmpNo)) {
    values.employeeNumber = labeledEmpNo.split(/\s+/)[0];
    filled.add('employeeNumber');
  } else if (inlinePfMatch) {
    values.employeeNumber = inlinePfMatch[0].toUpperCase();
    filled.add('employeeNumber');
  }

  // 4. Email Address
  const emailMatches = Array.from(
    normalizedText.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)
  ).map(m => m[0].toLowerCase());
  if (emailMatches.length > 0) {
    values.email = emailMatches[0];
    filled.add('email');
  }

  // 5. Phone & Emergency Contact / Emergency Phone
  const labeledEmergencyName = findLabeledValue(lines, [
    /emergency\s*contact(?:\s*name)?/,
    /next\s*of\s*kin(?:\s*name)?/,
  ]);
  if (labeledEmergencyName) {
    // Strip trailing phone if written on same line (e.g. "Sipho Moyo - 082 555 0192")
    const nameOnly = labeledEmergencyName
      .replace(/(?:\+\d{1,3}[\s()-]*|0)(?:\d[\s()-]*){8,12}/g, '')
      .trim()
      .replace(/[-–,/:]+$/, '')
      .trim();
    if (nameOnly && /[A-Za-z]{2,}/.test(nameOnly)) {
      values.emergencyName = nameOnly;
      filled.add('emergencyName');
    }
    const inlineEmergPhone = cleanPhoneCandidate(labeledEmergencyName);
    if (inlineEmergPhone) {
      values.emergencyPhone = inlineEmergPhone;
      filled.add('emergencyPhone');
    }
  }

  const labeledEmergencyPhone = findLabeledValue(lines, [
    /emergency\s*(?:phone|number|no\.?|tel|cell|mobile)/,
    /next\s*of\s*kin\s*(?:phone|number|tel|cell)/,
  ]);
  if (labeledEmergencyPhone) {
    const cleaned = cleanPhoneCandidate(labeledEmergencyPhone);
    if (cleaned) {
      values.emergencyPhone = cleaned;
      filled.add('emergencyPhone');
    }
  }

  const labeledPrimaryPhone = findLabeledValue(lines, [
    /(?:contact|phone|mobile|cell(?:phone)?|telephone|tel)\s*(?:number|no\.?)?/,
  ]);
  if (labeledPrimaryPhone) {
    const cleaned = cleanPhoneCandidate(labeledPrimaryPhone);
    if (cleaned) {
      values.phone = cleaned;
      filled.add('phone');
    }
  }

  if (!filled.has('phone')) {
    // Find any standalone phone number that isn't the ID number or emergencyPhone
    const textWithoutIds = values.idNumber
      ? normalizedText.replaceAll(values.idNumber, ' ')
      : normalizedText;
    const allPhones = Array.from(
      textWithoutIds.matchAll(/(?:\+27|0)[1-8]\d(?:[\s()-]*\d){7}\b/g)
    ).map(m => m[0].trim().replace(/\s+/g, ' '));

    for (const candidate of allPhones) {
      if (candidate !== values.emergencyPhone) {
        values.phone = candidate;
        filled.add('phone');
        break;
      }
    }
  }

  // 6. Home Address
  const labeledAddress = findLabeledValue(lines, [
    /(?:home|residential|physical|street|postal)\s*address/,
    /address/,
  ]);
  if (labeledAddress && labeledAddress.length >= 5) {
    values.address = labeledAddress;
    filled.add('address');
  }

  // 7. Job Title
  const labeledJobTitle = findLabeledValue(lines, [
    /job\s*title/,
    /position/,
    /role/,
    /designation/,
    /occupation/,
  ]);
  if (labeledJobTitle && /[A-Za-z]{2,}/.test(labeledJobTitle)) {
    values.jobTitle = labeledJobTitle;
    filled.add('jobTitle');
  }

  // 8. Department (only mark filled if explicitly found in OCR text)
  const labeledDept = findLabeledValue(lines, [/department/, /division/, /team/]);
  if (labeledDept) {
    const matched = options.departments.find(
      d =>
        d.toLowerCase() === labeledDept.toLowerCase() ||
        labeledDept.toLowerCase().includes(d.toLowerCase()) ||
        d.toLowerCase().includes(labeledDept.toLowerCase())
    );
    if (matched) {
      values.department = matched;
      filled.add('department');
    }
  } else {
    for (const dept of options.departments) {
      const re = new RegExp(`\\b${escapeRegExp(dept)}\\b`, 'i');
      if (re.test(normalizedText)) {
        values.department = dept;
        filled.add('department');
        break;
      }
    }
  }

  // 9. Manager / Reports To
  const labeledManager = findLabeledValue(lines, [
    /reports\s*to/,
    /line\s*manager/,
    /manager/,
    /supervisor/,
  ]);
  if (labeledManager && /[A-Za-z]{2,}/.test(labeledManager)) {
    values.manager = labeledManager;
    filled.add('manager');
  }

  // 10. Employment Type
  const labeledEmpType = findLabeledValue(lines, [
    /employment\s*type/,
    /contract\s*type/,
    /work\s*type/,
  ]);
  const empTypeSource = labeledEmpType || normalizedText;
  if (/\bfull[\s-]*time\b/i.test(empTypeSource)) {
    values.employmentType = 'Full-time' as EmploymentType;
    filled.add('employmentType');
  } else if (/\bpart[\s-]*time\b/i.test(empTypeSource)) {
    values.employmentType = 'Part-time' as EmploymentType;
    filled.add('employmentType');
  } else if (/\b(?:fixed[\s-]*term|contractor|independent\s*contract)\b/i.test(empTypeSource) || (labeledEmpType && /\bcontract\b/i.test(labeledEmpType))) {
    values.employmentType = 'Contract' as EmploymentType;
    filled.add('employmentType');
  }

  // 11. Start Date
  const labeledStartDate = findLabeledValue(lines, [
    /start\s*date/,
    /commencement\s*date/,
    /date\s*(?:joined|hired|engaged)/,
    /hire\s*date/,
    /effective\s*date/,
  ]);
  if (labeledStartDate) {
    const parsedStart = parseFlexibleDate(labeledStartDate);
    if (parsedStart) {
      values.startDate = parsedStart;
      filled.add('startDate');
    }
  }

  // 12. Branch
  const labeledBranch = findLabeledValue(lines, [
    /branch/,
    /office\s*location/,
    /site/,
    /depot/,
  ]);
  const branchText = labeledBranch || normalizedText;
  const branchAliases: Record<string, string[]> = {
    ekurhuleni: ['ekurhuleni', 'east rand', 'boksburg', 'benoni', 'germiston', 'kempton park'],
    joburg: ['joburg', 'johannesburg', 'sandton', 'rosebank', 'midrand', 'roodepoort', 'soweto'],
    tshwane: ['tshwane', 'pretoria', 'centurion', 'menlyn', 'hatfield'],
  };
  for (const branch of options.branches) {
    const lowerName = branch.name.toLowerCase();
    const aliases = branchAliases[lowerName] ?? [lowerName];
    if (
      aliases.some(alias =>
        new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i').test(branchText)
      )
    ) {
      values.branchId = branch.id;
      filled.add('branchId');
      break;
    }
  }

  // 13. Monthly Salary
  const labeledSalary = findLabeledValue(lines, [
    /monthly\s*(?:salary|pay|remuneration|gross)/,
    /basic\s*(?:salary|pay)/,
    /gross\s*(?:salary|pay)/,
    /remuneration/,
    /salary/,
    /ctc/,
  ]);
  const salarySource =
    labeledSalary ||
    (normalizedText.match(/(?:R|ZAR)\s?\d[\d\s,]{2,12}(?:\.\d{2})?/i)?.[0] ?? '');
  if (salarySource) {
    const numMatch = salarySource.match(/(\d[\d\s,]*\d(?:\.\d{1,2})?)/);
    if (numMatch) {
      const numeric = Number(numMatch[1].replace(/[\s,]/g, ''));
      if (Number.isFinite(numeric) && numeric >= 500 && numeric <= 5000000) {
        const isAnnual = /\b(?:per\s*annum|p\.?a\.?|annual)\b/i.test(salarySource);
        values.monthlySalary = isAnnual
          ? Math.round((numeric / 12) * 100) / 100
          : numeric;
        filled.add('monthlySalary');
      }
    }
  }

  // 14. Status
  const labeledStatus = findLabeledValue(lines, [/employment\s*status/, /status/]);
  if (labeledStatus) {
    if (/\bactive\b/i.test(labeledStatus)) {
      values.status = 'Active' as Status;
      filled.add('status');
    } else if (/\bon\s*leave\b/i.test(labeledStatus)) {
      values.status = 'On leave' as Status;
      filled.add('status');
    } else if (/\bresigned\b/i.test(labeledStatus)) {
      values.status = 'Resigned' as Status;
      filled.add('status');
    } else if (/\bterminated\b/i.test(labeledStatus)) {
      values.status = 'Terminated' as Status;
      filled.add('status');
    }
  }

  // 15. Bio / Summary, Skills, Languages
  const labeledBio = findLabeledValue(lines, [
    /(?:short\s*)?bio/,
    /professional\s*summary/,
    /profile\s*summary/,
    /about\s*me/,
  ]);
  if (labeledBio && labeledBio.length >= 8) {
    values.bio = labeledBio.slice(0, 350);
    filled.add('bio');
  }

  const labeledSkills = findLabeledValue(lines, [
    /key\s*skills/,
    /core\s*skills/,
    /skills/,
    /competencies/,
  ]);
  if (labeledSkills && labeledSkills.length >= 2) {
    values.skills = labeledSkills;
    filled.add('skills');
  }

  const labeledLanguages = findLabeledValue(lines, [
    /languages?/,
    /home\s*language/,
  ]);
  if (labeledLanguages) {
    values.languages = labeledLanguages;
    filled.add('languages');
  } else {
    const detectedLangs = SA_LANGUAGES.filter(lang =>
      new RegExp(`\\b${escapeRegExp(lang)}\\b`, 'i').test(normalizedText)
    );
    if (detectedLangs.length > 0) {
      values.languages = Array.from(new Set(detectedLangs)).join(', ');
      filled.add('languages');
    }
  }

  // 16. Custom workspace fields
  for (const field of options.customFields) {
    const val = findLabeledValue(lines, [new RegExp(escapeRegExp(field.label), 'i')]);
    if (val) {
      if (field.type === 'Date') {
        const parsed = parseFlexibleDate(val);
        if (parsed) {
          values.custom[field.label] = parsed;
          filled.add(`custom:${field.label}`);
        }
      } else if (field.type === 'Number') {
        const num = val.match(/-?\d+(?:\.\d+)?/);
        if (num) {
          values.custom[field.label] = num[0];
          filled.add(`custom:${field.label}`);
        }
      } else {
        values.custom[field.label] = val;
        filled.add(`custom:${field.label}`);
      }
    }
  }

  const aboutKeys: string[] = [
    ...ABOUT_BASE_FIELD_KEYS,
    ...options.customFields.map(f => `custom:${f.label}`),
  ];
  const allExpectedKeys: string[] = [
    ...PERSONAL_FIELD_KEYS,
    ...EMPLOYMENT_FIELD_KEYS,
    ...aboutKeys,
  ];

  const missingFields = allExpectedKeys.filter(k => !filled.has(k));

  const countFilled = (keys: readonly string[]) =>
    keys.filter(k => filled.has(k)).length;

  const personalFilled = countFilled(PERSONAL_FIELD_KEYS);
  const employmentFilled = countFilled(EMPLOYMENT_FIELD_KEYS);
  const aboutFilled = countFilled(aboutKeys);

  return {
    values,
    filledFields: Array.from(filled),
    missingFields,
    blocks: {
      personal: {
        filledCount: personalFilled,
        totalCount: PERSONAL_FIELD_KEYS.length,
        allMissing: personalFilled === 0,
      },
      employment: {
        filledCount: employmentFilled,
        totalCount: EMPLOYMENT_FIELD_KEYS.length,
        allMissing: employmentFilled === 0,
      },
      about: {
        filledCount: aboutFilled,
        totalCount: aboutKeys.length,
        allMissing: aboutFilled === 0,
      },
    },
    rawText: lines.join('\n'),
  };
}

/**
 * Prepares a captured photo for OCR (contrast-stretched grayscale canvas up to
 * 2000px) and also returns a compact JPEG preview suitable for attaching to the
 * employee record without exceeding browser storage limits.
 */
export async function preprocessImageForOcr(source: Blob | string): Promise<{
  ocrDataUrl: string;
  previewDataUrl: string;
  sizeLabel: string;
}> {
  const objectUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not decode image file.'));
      element.src = objectUrl;
    });

    const rawW = img.naturalWidth || img.width || 1;
    const rawH = img.naturalHeight || img.height || 1;

    // Upscale tiny images slightly for better Tesseract glyph clarity; cap huge photos at 2000px
    const maxDim = Math.max(rawW, rawH);
    const ocrScale =
      maxDim > 2000 ? 2000 / maxDim : maxDim < 900 ? Math.min(2, 1200 / maxDim) : 1;

    const ocrW = Math.max(1, Math.round(rawW * ocrScale));
    const ocrH = Math.max(1, Math.round(rawH * ocrScale));

    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width = ocrW;
    ocrCanvas.height = ocrH;
    const ocrCtx = ocrCanvas.getContext('2d');
    if (!ocrCtx) {
      throw new Error('Canvas 2D context unavailable.');
    }

    ocrCtx.fillStyle = '#ffffff';
    ocrCtx.fillRect(0, 0, ocrW, ocrH);
    ocrCtx.drawImage(img, 0, 0, ocrW, ocrH);

    // Gentle auto-levels grayscale boost so phone photos of ID cards / paper forms read cleanly
    const imageData = ocrCtx.getImageData(0, 0, ocrW, ocrH);
    const data = imageData.data;
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    const range = Math.max(40, maxLum - minLum);
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const stretched = Math.max(
        0,
        Math.min(255, Math.round(((lum - minLum) / range) * 255))
      );
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }
    ocrCtx.putImageData(imageData, 0, 0);
    const ocrDataUrl = ocrCanvas.toDataURL('image/png');

    // Compact colour preview for UI thumbnail & optional EmployeeDocument attachment
    const prevScale = maxDim > 1100 ? 1100 / maxDim : 1;
    const prevW = Math.max(1, Math.round(rawW * prevScale));
    const prevH = Math.max(1, Math.round(rawH * prevScale));
    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = prevW;
    prevCanvas.height = prevH;
    const prevCtx = prevCanvas.getContext('2d');
    if (prevCtx) {
      prevCtx.fillStyle = '#ffffff';
      prevCtx.fillRect(0, 0, prevW, prevH);
      prevCtx.drawImage(img, 0, 0, prevW, prevH);
    }
    const previewDataUrl = prevCanvas.toDataURL('image/jpeg', 0.78);
    const approxBytes = Math.round((previewDataUrl.length * 3) / 4);
    const sizeLabel =
      approxBytes >= 1024 * 1024
        ? `${(approxBytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(approxBytes / 1024))} KB`;

    return { ocrDataUrl, previewDataUrl, sizeLabel };
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function runEmployeeImageOcr(
  source: Blob | string,
  options: {
    branches: Branch[];
    departments: string[];
    customFields: CustomField[];
  },
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<{
  extraction: EmployeeOcrExtraction;
  previewDataUrl: string;
  sizeLabel: string;
}> {
  onProgress?.({ status: 'Enhancing photo clarity…', progress: 8 });
  const { ocrDataUrl, previewDataUrl, sizeLabel } =
    await preprocessImageForOcr(source);

  onProgress?.({ status: 'Loading OCR engine…', progress: 18 });
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: msg => {
      if (msg.status === 'recognizing text') {
        const pct = Math.min(96, Math.round(25 + (msg.progress || 0) * 70));
        onProgress?.({ status: 'Reading details from photo…', progress: pct });
      }
    },
  });

  try {
    const result = await worker.recognize(ocrDataUrl);
    onProgress?.({ status: 'Mapping fields to employee form…', progress: 99 });
    const extraction = extractEmployeeFieldsFromOcrText(
      result.data?.text ?? '',
      options
    );
    onProgress?.({ status: 'Complete', progress: 100 });
    return { extraction, previewDataUrl, sizeLabel };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
