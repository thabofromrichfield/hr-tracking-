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

/**
 * The 8 high-priority fields the OCR engine hunts down first across every layout.
 */
export const PRIORITY_OCR_FIELDS = [
  { key: 'idNumber', label: 'ID number' },
  { key: 'phone', label: 'Contact number' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email address' },
  { key: 'address', label: 'Home address' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'startDate', label: 'Start date' },
] as const;

export interface EmployeeOcrExtraction {
  values: Partial<EmployeeFormDraft> & { custom?: Record<string, string> };
  filledFields: string[];
  missingFields: string[];
  priorityFound: string[];
  priorityMissing: string[];
  blocks: Record<EmployeeBlockKey, BlockScanStatus>;
  rawText: string;
}

export interface OcrProgressUpdate {
  status: string;
  progress: number; // 0..100
}

export const PERSONAL_FIELD_KEYS = [
  'fullName',
  'idNumber',
  'dob',
  'phone',
  'email',
  'address',
  'employeeNumber',
  'emergencyName',
  'emergencyPhone',
] as const;

export const EMPLOYMENT_FIELD_KEYS = [
  'jobTitle',
  'startDate',
  'manager',
  'employmentType',
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
  'CONFIDENTIAL',
  'APPLICATION',
  'PROFILE',
  'SUMMARY',
  'PAGE',
  'COMPANY',
  'DEPARTMENT',
  'ADDRESS',
  'CONTACT',
]);

const ROLE_KEYWORDS_RE =
  /\b(?:manager|officer|coordinator|administrator|admin|engineer|developer|designer|driver|operator|technician|specialist|analyst|assistant|clerk|supervisor|director|consultant|accountant|receptionist|controller|lead|intern|worker|agent|representative|executive|artisan|mechanic|electrician|welder|packer|picker|cashier|cleaner|guard|nurse|practitioner|trainer|hr|payroll|recruiter)\b/i;

const SA_STREET_RE =
  /\b(?:\d{1,5}[A-Za-z]?\s+[A-Za-z0-9'\s]{2,35}\s+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|close|cl|crescent|cres|boulevard|blvd|way|place|pl|court|ct|highway|hwy|terrace|ext|extension|section|stand|erf|plot|unit|complex|estate|gardens|park))\b/i;

const SA_LOCALITY_RE =
  /\b(?:johannesburg|joburg|sandton|rosebank|midrand|randburg|roodepoort|soweto|orlando|diepkloof|alexandra|fourways|bryanston|ekurhuleni|boksburg|benoni|germiston|kempton\s*park|edenvale|bedfordview|springs|brakpan|alberton|tembisa|katlehong|tshwane|pretoria|centurion|hatfield|menlyn|arcadia|soshanguve|mamelodi|mogale|krugersdorp|vanderbijlpark|vereeniging|durban|umhlanga|pinetown|pietermaritzburg|cape\s*town|bellville|stellenbosch|paarl|gqeberha|port\s*elizabeth|east\s*london|bloemfontein|polokwane|mbombela|nelspruit|rustenburg|kimberley|mahikeng|witbank|emalahleni|secunda|gauteng|kwazulu[\s-]*natal|western\s*cape|eastern\s*cape|free\s*state|limpopo|mpumalanga|north\s*west|northern\s*cape)\b/i;

/**
 * Known field labels used to split multi-column horizontal OCR lines so one
 * field never swallows another field printed to its right on the same row.
 */
const INLINE_SPLIT_LABELS = [
  'Full Names?',
  'Employee Name',
  'Applicant Name',
  'Candidate Name',
  'Name\\s*(?:&|and)\\s*Surname',
  'First Names?',
  'Forenames?',
  'Given Names?',
  'Surname',
  'Last Name',
  'Employee\\s*(?:Number|No\\.?|ID|Code)',
  'Staff\\s*(?:Number|No\\.?|ID)',
  'Personnel\\s*(?:Number|No\\.?)',
  'Identity\\s*(?:Number|No\\.?)',
  'National\\s*ID(?:\\s*No\\.?)?',
  'SA\\s*ID(?:\\s*No\\.?)?',
  'ID\\s*(?:Number|No\\.?)',
  'Passport\\s*(?:Number|No\\.?)',
  'Date\\s*of\\s*Birth',
  'Birth\\s*Date',
  'Birthdate',
  'D\\.?O\\.?B\\.?',
  'Email\\s*Address',
  'Work\\s*Email',
  'Personal\\s*Email',
  'E-?mail',
  'Contact\\s*(?:Number|No\\.?)',
  'Phone\\s*(?:Number|No\\.?)?',
  'Mobile\\s*(?:Number|No\\.?)?',
  'Cell(?:phone)?(?:\\s*(?:Number|No\\.?))?',
  'Telephone(?:\\s*(?:Number|No\\.?))?',
  'Tel(?:\\s*No\\.?)?',
  'Home\\s*Address',
  'Residential\\s*Address',
  'Physical\\s*Address',
  'Street\\s*Address',
  'Postal\\s*Address',
  'Current\\s*Address',
  'Address',
  'Emergency\\s*Contact(?:\\s*Name)?',
  'Next\\s*of\\s*Kin(?:\\s*Name)?',
  'Emergency\\s*(?:Phone|Number|No\\.?|Tel|Cell)',
  'Job\\s*Title',
  'Job\\s*Role',
  'Current\\s*Role',
  'Position',
  'Designation',
  'Occupation',
  'Department',
  'Reports\\s*To',
  'Line\\s*Manager',
  'Manager',
  'Supervisor',
  'Employment\\s*Type',
  'Contract\\s*Type',
  'Start(?:ing)?\\s*Date',
  'Commencement\\s*Date',
  'Date\\s*of\\s*Commencement',
  'Date\\s*Joined',
  'Joining\\s*Date',
  'Date\\s*Hired',
  'Hire\\s*Date',
  'Date\\s*of\\s*Engagement',
  'Engagement\\s*Date',
  'Date\\s*of\\s*Appointment',
  'Appointment\\s*Date',
  'Effective\\s*Date',
  'Date\\s*Employed',
  'Branch',
  'Office\\s*Location',
  'Monthly\\s*Salary',
  'Basic\\s*Salary',
  'Gross\\s*Salary',
  'Remuneration',
  'Salary',
  'CTC',
  'Employment\\s*Status',
  'Key\\s*Skills',
  'Skills',
  'Competencies',
  'Home\\s*Language',
  'Languages?',
];

const INLINE_LABEL_SPLIT_RE = new RegExp(
  `(?:\\s{2,}|\\s*[|•·;]\\s*)(?=(?:${INLINE_SPLIT_LABELS.join('|')})\\s*[:\\-–])`,
  'gi'
);

const TABULAR_GAP_LABEL_RE = new RegExp(
  `\\s{2,}(?=(?:${INLINE_SPLIT_LABELS.join('|')})\\b)`,
  'gi'
);

const ANY_FIELD_LABEL_START_RE = new RegExp(
  `^(?:${INLINE_SPLIT_LABELS.join('|')}|Name|Role|Title|Post|Status|Bio|Summary|About|Sex|Gender|Nationality|Citizenship|Marital\\s*Status|Tax\\s*(?:Number|No\\.?)|Bank|Account\\s*(?:Number|No\\.?))\\b`,
  'i'
);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTitleCase(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function cleanHonorifics(name: string): string {
  return name
    .replace(/^(?:mr|mrs|ms|miss|dr|prof|adv|rev)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Repairs common camera OCR confusions inside digit sequences (O->0, I/l->1, etc.).
 */
export function healOcrDigits(raw: string): string {
  return raw.replace(
    /\b(?=[0-9OoQDIl|!\s-]*\d)[0-9OoQDIl|!]+(?:[\s-][0-9OoQDIl|!]+)*\b/g,
    segment =>
      segment
        .replace(/[OoQD]/g, '0')
        .replace(/[Il|!]/g, '1')
  );
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

function isValidLuhn13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    let d = Number(digits[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Parses South African, ISO, verbal, dot-separated, and OCR-noisy dates into YYYY-MM-DD.
 */
export function parseFlexibleDate(raw: string): string | null {
  const healed = healOcrDigits(raw)
    .trim()
    .replace(/[,]/g, ' ')
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1')
    .replace(/\s+/g, ' ');
  if (!healed) return null;

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const iso = healed.match(
    /\b(19\d{2}|20\d{2})\s*[-/.]\s*(0?[1-9]|1[0-2])\s*[-/.]\s*(0?[1-9]|[12]\d|3[01])\b/
  );
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD MMM YYYY or DD-MMM-YYYY (e.g. 12 AUG 1994, 01-Nov-2026, 5 November 2026)
  const dmyWords = healed.match(
    /\b(0?[1-9]|[12]\d|3[01])[\s./-]+([A-Za-z]{3,9})[\s./-]+(19\d{2}|20\d{2})\b/
  );
  if (dmyWords) {
    const d = Number(dmyWords[1]);
    const mStr = MONTHS[dmyWords[2].toLowerCase()];
    const y = Number(dmyWords[3]);
    if (mStr && isValidCalendarDate(y, Number(mStr), d)) {
      return `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    }
  }

  // MMM DD YYYY (e.g. Aug 12 1994, November 1, 2026)
  const mdyWords = healed.match(
    /\b([A-Za-z]{3,9})[\s./-]+(0?[1-9]|[12]\d|3[01])[\s./-]+(19\d{2}|20\d{2})\b/
  );
  if (mdyWords) {
    const mStr = MONTHS[mdyWords[1].toLowerCase()];
    const d = Number(mdyWords[2]);
    const y = Number(mdyWords[3]);
    if (mStr && isValidCalendarDate(y, Number(mStr), d)) {
      return `${y}-${mStr}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (South African standard DMY)
  const dmyNumeric = healed.match(
    /\b(0?[1-9]|[12]\d|3[01])\s*[/. -]\s*(0?[1-9]|1[0-2])\s*[/. -]\s*(19\d{2}|20\d{2})\b/
  );
  if (dmyNumeric) {
    const d = Number(dmyNumeric[1]);
    const m = Number(dmyNumeric[2]);
    const y = Number(dmyNumeric[3]);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YY (2-digit year when clearly separated by slashes)
  const dmyShort = healed.match(
    /\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](\d{2})\b/
  );
  if (dmyShort) {
    const d = Number(dmyShort[1]);
    const m = Number(dmyShort[2]);
    const yy = Number(dmyShort[3]);
    const currentYY = new Date().getFullYear() % 100;
    const y = yy <= currentYY + 4 ? 2000 + yy : 1900 + yy;
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function extractAllDatesInOrder(rawText: string): string[] {
  const healed = healOcrDigits(rawText);
  const tokenRe =
    /\b(?:(?:19|20)\d{2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}|\d{1,2}[\s./-]+[A-Za-z]{3,9}[\s./-]+(?:19|20)\d{2}|[A-Za-z]{3,9}[\s./-]+\d{1,2}[\s,./-]+(?:19|20)\d{2}|\d{1,2}\s*[/. -]\s*\d{1,2}\s*[/. -]\s*(?:19|20)\d{2})\b/g;

  const found: string[] = [];
  for (const m of healed.matchAll(tokenRe)) {
    const parsed = parseFlexibleDate(m[0]);
    if (parsed && !found.includes(parsed)) {
      found.push(parsed);
    }
  }
  return found;
}

/**
 * Hunts down a 13-digit South African ID number anywhere in the text — even
 * with spaces between digits (boxed forms) or camera O/0/I/1 noise — and
 * derives the ISO Date of Birth from YYMMDD.
 */
export function parseSouthAfricanId(rawText: string): {
  idNumber: string;
  dob: string;
} | null {
  const healed = healOcrDigits(rawText);
  // Match 13 digits allowing single spaces or hyphens between groups or individual boxed digits
  const pattern = /(?<!\d)(?:\d[\s-]?){12}\d(?!\d)/g;
  const currentTwoDigitYear = new Date().getFullYear() % 100;

  let bestValid: { idNumber: string; dob: string; luhn: boolean } | null = null;

  for (const match of healed.matchAll(pattern)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length !== 13) continue;

    const yy = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const dd = Number(digits.slice(4, 6));
    const citizenship = digits[10];

    if (citizenship !== '0' && citizenship !== '1' && citizenship !== '2') {
      continue;
    }

    const century = yy <= Math.max(0, currentTwoDigitYear - 14) ? 2000 : 1900;
    const fullYear = century + yy;
    if (!isValidCalendarDate(fullYear, mm, dd)) {
      continue;
    }

    const dob = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const luhn = isValidLuhn13(digits);

    if (luhn) {
      return { idNumber: digits, dob };
    }
    if (!bestValid) {
      bestValid = { idNumber: digits, dob, luhn: false };
    }
  }

  return bestValid ? { idNumber: bestValid.idNumber, dob: bestValid.dob } : null;
}

/**
 * Splits multi-column rows into clean individual segments while preserving
 * original line order.
 */
function expandStructuredLines(rawText: string): string[] {
  const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');
  const expanded: string[] = [];

  for (const rawLine of rawLines) {
    const tabNormalized = rawLine.replace(/\t+/g, '   ').trim();
    if (!tabNormalized) continue;

    const firstPass = tabNormalized.split(INLINE_LABEL_SPLIT_RE);
    for (const chunk of firstPass) {
      const secondPass = chunk.split(TABULAR_GAP_LABEL_RE);
      for (const piece of secondPass) {
        const cleaned = piece.replace(/[|•·]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned) {
          expanded.push(cleaned);
        }
      }
    }
  }

  return expanded;
}

/**
 * Finds a labeled value whether written as `Label: Value`, `Label - Value`,
 * `Label   Value` (printed form without colon), or `Label` on line i and
 * `Value` on line i+1.
 */
function findLabeledValue(
  lines: string[],
  labelPatterns: RegExp[],
  options?: { allowMultiline?: number }
): string | null {
  const maxExtraLines = options?.allowMultiline ?? 0;

  const joinParts = (parts: string[]) =>
    parts
      .map(p => p.replace(/,+\s*$/, '').trim())
      .filter(Boolean)
      .join(', ');

  for (const pattern of labelPatterns) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      // 1. Explicit delimiter (:, ;, -, –, =) anywhere from start of segment
      const delimited = line.match(
        new RegExp(`^(?:${pattern.source})\\s*[:;=\\-–]+\\s*(.+)$`, 'i')
      );
      if (delimited && delimited[1].trim()) {
        const valParts = [delimited[1].trim()];
        for (let k = 1; k <= maxExtraLines; k += 1) {
          const next = lines[i + k]?.trim();
          if (!next || ANY_FIELD_LABEL_START_RE.test(next) || /@/.test(next)) break;
          valParts.push(next);
        }
        return joinParts(valParts);
      }

      // 2. Vertical label (label alone on line i, value on line i+1)
      if (new RegExp(`^(?:${pattern.source})\\s*[:;=\\-–]?$`, 'i').test(line)) {
        const nextLine = lines[i + 1]?.trim();
        if (
          nextLine &&
          !ANY_FIELD_LABEL_START_RE.test(nextLine) &&
          nextLine.length <= 160
        ) {
          const valParts = [nextLine];
          for (let k = 2; k <= 1 + maxExtraLines; k += 1) {
            const extra = lines[i + k]?.trim();
            if (!extra || ANY_FIELD_LABEL_START_RE.test(extra) || /@/.test(extra)) break;
            valParts.push(extra);
          }
          return joinParts(valParts);
        }
      }

      // 3. Colon-less form box (e.g. "ID Number 9408125800087" or "Start Date 01/11/2026")
      const spaceSeparated = line.match(
        new RegExp(`^(?:${pattern.source})\\s+([^:;=]{2,120})$`, 'i')
      );
      if (spaceSeparated && spaceSeparated[1].trim()) {
        const candidate = spaceSeparated[1].trim();
        if (!ANY_FIELD_LABEL_START_RE.test(candidate)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function cleanPhoneCandidate(raw: string): string | null {
  const healed = healOcrDigits(raw);
  const match = healed.match(
    /(?:\+?\s*27[\s().-]*|0)(?:[1-8]\d)(?:[\s().-]*\d){7}\b|(?:\+\d{1,3}[\s().-]*)(?:\d[\s().-]*){7,12}\b/
  );
  if (!match) return null;

  const rawToken = match[0].trim();
  const digitsOnly = rawToken.replace(/\D/g, '');

  // Format South African numbers cleanly (+27 XX XXX XXXX or 0XX XXX XXXX)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('27')) {
    return `+27 ${digitsOnly.slice(2, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
  }
  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
  }
  if (digitsOnly.length >= 9 && digitsOnly.length <= 15) {
    return rawToken.replace(/\s+/g, ' ');
  }
  return null;
}

function extractAllEmails(rawText: string): string[] {
  // Repair camera OCR spaces around @ and dots (e.g. "sipho . nkosi @ company . co . za")
  const repaired = rawText.replace(
    /([A-Za-z0-9_%+-]+(?:\s*\.\s*[A-Za-z0-9_%+-]+)*)\s*@\s*([A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z]{2,})+)/g,
    (_full, local: string, domain: string) =>
      `${local.replace(/\s+/g, '')}@${domain.replace(/\s+/g, '')}`
  );

  const matches = Array.from(
    repaired.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)
  ).map(m => m[0].toLowerCase().replace(/[.,;:)]+$/, ''));

  return Array.from(new Set(matches));
}

function detectUnlabeledAddress(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (ANY_FIELD_LABEL_START_RE.test(line) || /@/.test(line)) continue;

    if (SA_STREET_RE.test(line)) {
      const parts = [line];
      const alreadyHasPostal = /\b\d{4}\s*$/.test(line);
      const next1 = lines[i + 1];
      if (
        !alreadyHasPostal &&
        next1 &&
        next1.length <= 65 &&
        !/:/.test(next1) &&
        !ANY_FIELD_LABEL_START_RE.test(next1) &&
        !/@/.test(next1) &&
        (SA_LOCALITY_RE.test(next1) || /\b(?!19\d{2}|20\d{2})\d{4}\b/.test(next1))
      ) {
        parts.push(next1);
        const next2 = lines[i + 2];
        if (
          next2 &&
          !ANY_FIELD_LABEL_START_RE.test(next2) &&
          /^\d{4}$/.test(next2.trim())
        ) {
          parts.push(next2.trim());
        }
      }
      return parts.join(', ');
    }

    // Locality + 4-digit SA postal code line (e.g. "Orlando West, Soweto, 1804")
    if (SA_LOCALITY_RE.test(line) && /\b\d{4}\b/.test(line) && line.length <= 110) {
      const prev = lines[i - 1];
      if (
        prev &&
        !ANY_FIELD_LABEL_START_RE.test(prev) &&
        !/@/.test(prev) &&
        /\d/.test(prev) &&
        prev.length <= 80
      ) {
        return `${prev}, ${line}`;
      }
      return line;
    }
  }
  return null;
}

export function extractEmployeeFieldsFromOcrText(
  rawText: string,
  options: {
    branches: Branch[];
    departments?: string[];
    customFields: CustomField[];
  }
): EmployeeOcrExtraction {
  const normalizedText = rawText.replace(/\r\n/g, '\n');
  const lines = expandStructuredLines(normalizedText);

  const values: Partial<EmployeeFormDraft> & { custom: Record<string, string> } = {
    custom: {},
  };
  const filled = new Set<string>();

  // =========================================================================
  // PRIORITY 1 & 3: ID NUMBER + DATE OF BIRTH
  // =========================================================================
  const saId = parseSouthAfricanId(normalizedText);
  const labeledId = findLabeledValue(lines, [
    /(?:sa\s*)?id(?:entity)?\s*(?:number|no\.?|num|#)/,
    /national\s*id(?:\s*(?:number|no\.?))?/,
    /identification\s*(?:number|no\.?)/,
    /passport\s*(?:number|no\.?)/,
    /\bid\b/,
  ]);

  if (saId) {
    values.idNumber = saId.idNumber;
    filled.add('idNumber');
    values.dob = saId.dob;
    filled.add('dob');
  } else if (labeledId) {
    const saFromLabeled = parseSouthAfricanId(labeledId);
    if (saFromLabeled) {
      values.idNumber = saFromLabeled.idNumber;
      filled.add('idNumber');
      values.dob = saFromLabeled.dob;
      filled.add('dob');
    } else {
      const cleanedId = healOcrDigits(labeledId)
        .replace(/[^A-Za-z0-9-]/g, '')
        .trim();
      if (cleanedId.length >= 6 && cleanedId.length <= 24 && /\d{4,}/.test(cleanedId)) {
        values.idNumber = cleanedId;
        filled.add('idNumber');
      }
    }
  }

  const labeledDob = findLabeledValue(lines, [
    /date\s*of\s*b[i1l]rth/,
    /b[i1l]rth\s*date/,
    /b[i1l]rthdate/,
    /d\.?\s*o\.?\s*b\.?/,
    /born(?:\s*on)?/,
  ]);
  if (labeledDob) {
    const parsedDob = parseFlexibleDate(labeledDob);
    if (parsedDob) {
      values.dob = parsedDob;
      filled.add('dob');
    }
  }

  const allDocumentDates = extractAllDatesInOrder(normalizedText);
  if (!filled.has('dob')) {
    const birthEraDate = allDocumentDates.find(dt => {
      const yr = Number(dt.slice(0, 4));
      return yr >= 1945 && yr <= 2008;
    });
    if (birthEraDate) {
      values.dob = birthEraDate;
      filled.add('dob');
    }
  }

  // =========================================================================
  // PRIORITY 4: FULL NAME
  // =========================================================================
  const labeledFullName = findLabeledValue(lines, [
    /full\s*name(?:s)?/,
    /employee(?:'s)?\s*name/,
    /staff\s*name/,
    /applicant(?:'s)?\s*name/,
    /candidate(?:'s)?\s*name/,
    /name\s*(?:&|and)\s*surname/,
  ]);
  const surnameVal = findLabeledValue(lines, [
    /surname/,
    /last\s*name/,
    /family\s*name/,
  ]);
  const forenamesVal = findLabeledValue(lines, [
    /forenames?/,
    /first\s*names?/,
    /given\s*names?/,
    /christian\s*names?/,
    /names/,
  ]);

  let fullNameLineIndex = -1;

  if (labeledFullName && /[A-Za-z]{2,}/.test(labeledFullName)) {
    const cleaned = cleanHonorifics(
      labeledFullName.replace(/[^A-Za-z\s'-]/g, ' ')
    );
    values.fullName = /^[A-Z\s'-]+$/.test(cleaned) ? toTitleCase(cleaned) : cleaned;
    filled.add('fullName');
  } else if (surnameVal && forenamesVal) {
    const combined = cleanHonorifics(
      `${forenamesVal} ${surnameVal}`.replace(/[^A-Za-z\s'-]/g, ' ')
    );
    values.fullName = toTitleCase(combined);
    filled.add('fullName');
  } else {
    const plainName = findLabeledValue(lines, [/name/]);
    if (
      plainName &&
      /^[A-Za-z][A-Za-z\s.'-]{2,60}$/.test(plainName) &&
      !ROLE_KEYWORDS_RE.test(plainName)
    ) {
      const cleaned = cleanHonorifics(plainName);
      values.fullName = /^[A-Z\s'-]+$/.test(cleaned)
        ? toTitleCase(cleaned)
        : cleaned;
      filled.add('fullName');
    } else {
      for (let idx = 0; idx < Math.min(12, lines.length); idx += 1) {
        const candidateLine = cleanHonorifics(lines[idx]);
        if (/[@:\d]/.test(candidateLine)) continue;
        const words = candidateLine.split(/\s+/);
        if (words.length < 2 || words.length > 4) continue;
        if (!words.every(w => /^[A-Za-z'-]{2,22}$/.test(w))) continue;
        if (words.some(w => HEADER_STOPWORDS.has(w.toUpperCase()))) continue;
        if (ROLE_KEYWORDS_RE.test(candidateLine)) continue;

        values.fullName = toTitleCase(candidateLine);
        filled.add('fullName');
        fullNameLineIndex = idx;
        break;
      }
    }
  }

  // =========================================================================
  // PRIORITY 5: EMAIL ADDRESS
  // =========================================================================
  const labeledEmail = findLabeledValue(lines, [
    /(?:work\s*|personal\s*)?e-?mail(?:\s*address)?/,
  ]);
  if (labeledEmail) {
    const extracted = extractAllEmails(labeledEmail);
    if (extracted.length > 0) {
      values.email = extracted[0];
      filled.add('email');
    }
  }
  if (!filled.has('email')) {
    const allEmails = extractAllEmails(normalizedText);
    if (allEmails.length > 0) {
      values.email = allEmails[0];
      filled.add('email');
    }
  }

  // =========================================================================
  // PRIORITY 2: CONTACT NUMBER (+ Emergency Contact / Emergency Phone)
  // =========================================================================
  const labeledEmergencyName = findLabeledValue(lines, [
    /emergency\s*contact(?:\s*name)?/,
    /next\s*of\s*kin(?:\s*name)?/,
  ]);
  if (labeledEmergencyName) {
    const inlineEmergPhone = cleanPhoneCandidate(labeledEmergencyName);
    if (inlineEmergPhone) {
      values.emergencyPhone = inlineEmergPhone;
      filled.add('emergencyPhone');
    }
    const nameOnly = healOcrDigits(labeledEmergencyName)
      .replace(
        /(?:\+?\s*27[\s().-]*|0)(?:[1-8]\d)(?:[\s().-]*\d){7}\b/g,
        ''
      )
      .trim()
      .replace(/[-–,/:]+$/, '')
      .trim();
    if (nameOnly && /[A-Za-z]{2,}/.test(nameOnly)) {
      values.emergencyName = nameOnly;
      filled.add('emergencyName');
    }
  }

  const labeledEmergencyPhone = findLabeledValue(lines, [
    /emergency\s*(?:phone|number|no\.?|tel|cell|mobile|contact\s*no\.?)/,
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
    /contact\s*(?:number|no\.?|details?)?/,
    /(?:primary\s*)?(?:phone|mobile|cell(?:phone)?|telephone|tel|whatsapp)\s*(?:number|no\.?)?/,
  ]);
  if (labeledPrimaryPhone) {
    const cleaned = cleanPhoneCandidate(labeledPrimaryPhone);
    if (cleaned) {
      values.phone = cleaned;
      filled.add('phone');
    }
  }

  if (!filled.has('phone')) {
    let textWithoutIds = healOcrDigits(normalizedText);
    if (values.idNumber) {
      textWithoutIds = textWithoutIds.replace(
        new RegExp(values.idNumber.split('').join('[\\s-]?'), 'g'),
        ' '
      );
    }
    const allPhoneMatches = Array.from(
      textWithoutIds.matchAll(
        /(?:\+?\s*27[\s().-]*|0)(?:[1-8]\d)(?:[\s().-]*\d){7}\b/g
      )
    );
    for (const m of allPhoneMatches) {
      const formatted = cleanPhoneCandidate(m[0]);
      if (formatted && formatted !== values.emergencyPhone) {
        values.phone = formatted;
        filled.add('phone');
        break;
      }
    }
  }

  // =========================================================================
  // PRIORITY 6: HOME ADDRESS (Multi-line labeled + Unlabeled SA street/city)
  // =========================================================================
  const labeledAddress = findLabeledValue(
    lines,
    [
      /(?:home|residential|physical|street|current|permanent|postal)\s*address/,
      /place\s*of\s*residence/,
      /residential\s*street/,
      /address/,
    ],
    { allowMultiline: 2 }
  );
  if (labeledAddress && labeledAddress.length >= 5 && !/@/.test(labeledAddress)) {
    values.address = labeledAddress.replace(/\s*,\s*,/g, ', ').trim();
    filled.add('address');
  } else {
    const unlabeledAddr = detectUnlabeledAddress(lines);
    if (unlabeledAddr) {
      values.address = unlabeledAddr;
      filled.add('address');
    }
  }

  // =========================================================================
  // PRIORITY 7: JOB TITLE (Labeled + Contract prose + CV subtitle)
  // =========================================================================
  const labeledJobTitle = findLabeledValue(lines, [
    /job\s*title/,
    /job\s*role/,
    /current\s*(?:role|position)/,
    /position(?:\s*title)?/,
    /designation/,
    /occupation/,
    /post\s*held/,
    /\brole\b/,
  ]);
  if (labeledJobTitle && /[A-Za-z]{2,}/.test(labeledJobTitle)) {
    values.jobTitle = labeledJobTitle;
    filled.add('jobTitle');
  } else {
    // Offer letter / employment contract prose
    const proseRole = normalizedText.match(
      /\b(?:appointed\s+(?:as|to\s+the\s+position\s+of)|employed\s+as(?:\s+a|\s+an)?|position\s+of|in\s+the\s+capacity\s+of)\s+([A-Z][A-Za-z0-9&/\s-]{2,48}?)(?:[.,;\n]|\s+(?:in|at|with|effective|commencing|starting|on|from)\b)/i
    );
    if (proseRole && proseRole[1].trim()) {
      values.jobTitle = proseRole[1].trim();
      filled.add('jobTitle');
    } else if (fullNameLineIndex >= 0) {
      // Check the 1-2 lines immediately beneath the person's name on a CV or badge
      for (const offset of [1, 2]) {
        const sub = lines[fullNameLineIndex + offset];
        if (
          sub &&
          !ANY_FIELD_LABEL_START_RE.test(sub) &&
          !/[@\d]/.test(sub) &&
          sub.length <= 55 &&
          ROLE_KEYWORDS_RE.test(sub)
        ) {
          values.jobTitle = sub;
          filled.add('jobTitle');
          break;
        }
      }
    }
  }

  // =========================================================================
  // PRIORITY 8: START DATE (Labeled + Contract prose + Chronological date)
  // =========================================================================
  const labeledStartDate = findLabeledValue(lines, [
    /start(?:ing)?\s*date/,
    /commencement\s*date/,
    /date\s*of\s*commencement/,
    /date\s*(?:joined|hired|engaged|employed|appointed)/,
    /(?:joining|hire|engagement|appointment|effective|employment)\s*date/,
    /employed\s*from/,
  ]);
  if (labeledStartDate) {
    const parsedStart = parseFlexibleDate(labeledStartDate);
    if (parsedStart) {
      values.startDate = parsedStart;
      filled.add('startDate');
    }
  }
  if (!filled.has('startDate')) {
    const proseStart = normalizedText.match(
      /\b(?:commencing|starting|effective|joined|employed\s+from|start\s+on)\s*(?:on|from)?\s*[:\-]?\s*([0-9A-Za-z,./\s-]{6,25})/i
    );
    if (proseStart) {
      const parsed = parseFlexibleDate(proseStart[1]);
      if (parsed && parsed !== values.dob) {
        values.startDate = parsed;
        filled.add('startDate');
      }
    }
  }
  if (!filled.has('startDate')) {
    // Any valid modern employment date (2010..2030) distinct from DOB
    const dobYear = values.dob ? Number(values.dob.slice(0, 4)) : null;
    const candidateStart = allDocumentDates.find(dt => {
      if (dt === values.dob) return false;
      const yr = Number(dt.slice(0, 4));
      if (yr < 2010 || yr > 2030) return false;
      if (dobYear !== null && yr - dobYear < 16) return false;
      return true;
    });
    if (candidateStart) {
      values.startDate = candidateStart;
      filled.add('startDate');
    }
  }

  // =========================================================================
  // SECONDARY FIELDS: Employee No, Manager, Type, Branch, Salary, Bio, Skills
  // =========================================================================
  const labeledEmpNo = findLabeledValue(lines, [
    /employee\s*(?:number|no\.?|id|code)/,
    /staff\s*(?:number|no\.?|id)/,
    /personnel\s*(?:number|no\.?)/,
    /clock\s*(?:number|no\.?)/,
  ]);
  const inlinePfMatch = normalizedText.match(/\b(?:PF|EMP)[-/]?\d{2,6}\b/i);
  if (labeledEmpNo && /[A-Za-z0-9]{2,20}/.test(labeledEmpNo)) {
    values.employeeNumber = labeledEmpNo.split(/\s+/)[0];
    filled.add('employeeNumber');
  } else if (inlinePfMatch) {
    values.employeeNumber = inlinePfMatch[0].toUpperCase();
    filled.add('employeeNumber');
  }

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

  const labeledEmpType = findLabeledValue(lines, [
    /employment\s*type/,
    /contract\s*type/,
    /work\s*type/,
  ]);
  const empTypeSource = labeledEmpType || normalizedText;
  if (
    /\b(?:full[\s-]*time|permanent\s+(?:basis|position|role|employment|staff))\b/i.test(
      empTypeSource
    ) ||
    (labeledEmpType && /\bpermanent\b/i.test(labeledEmpType))
  ) {
    values.employmentType = 'Full-time' as EmploymentType;
    filled.add('employmentType');
  } else if (/\bpart[\s-]*time\b/i.test(empTypeSource)) {
    values.employmentType = 'Part-time' as EmploymentType;
    filled.add('employmentType');
  } else if (
    /\b(?:fixed[\s-]*term|contractor|independent\s*contract)\b/i.test(empTypeSource) ||
    (labeledEmpType && /\bcontract\b/i.test(labeledEmpType))
  ) {
    values.employmentType = 'Contract' as EmploymentType;
    filled.add('employmentType');
  }

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

  const labeledBio = findLabeledValue(
    lines,
    [/(?:short\s*)?bio/, /professional\s*summary/, /profile\s*summary/, /about\s*me/],
    { allowMultiline: 2 }
  );
  if (labeledBio && labeledBio.length >= 8) {
    values.bio = labeledBio.slice(0, 350);
    filled.add('bio');
  }

  const labeledSkills = findLabeledValue(
    lines,
    [/key\s*skills/, /core\s*skills/, /skills/, /competencies/],
    { allowMultiline: 1 }
  );
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
  const priorityFound = PRIORITY_OCR_FIELDS.filter(f => filled.has(f.key)).map(
    f => f.label
  );
  const priorityMissing = PRIORITY_OCR_FIELDS.filter(f => !filled.has(f.key)).map(
    f => f.label
  );

  const countFilled = (keys: readonly string[]) =>
    keys.filter(k => filled.has(k)).length;

  const personalFilled = countFilled(PERSONAL_FIELD_KEYS);
  const employmentFilled = countFilled(EMPLOYMENT_FIELD_KEYS);
  const aboutFilled = countFilled(aboutKeys);

  return {
    values,
    filledFields: Array.from(filled),
    missingFields,
    priorityFound,
    priorityMissing,
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
 * Prepares a captured photo for OCR using percentile luminance normalization
 * (preserving faint form labels and small text up to 2400px) and generates a
 * compact JPEG preview for attaching to employee documents.
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

    const maxDim = Math.max(rawW, rawH);
    const ocrScale =
      maxDim > 2400
        ? 2400 / maxDim
        : maxDim < 1400
        ? Math.min(2.2, 1600 / maxDim)
        : 1;

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

    // Percentile histogram normalization (2%..98%) so glare or dark borders never clip ink
    const imageData = ocrCtx.getImageData(0, 0, ocrW, ocrH);
    const data = imageData.data;
    const hist = new Uint32Array(256);
    let sampleCount = 0;

    for (let i = 0; i < data.length; i += 16) {
      const lum = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      hist[lum] += 1;
      sampleCount += 1;
    }

    const lowTarget = Math.floor(sampleCount * 0.02);
    const highTarget = Math.ceil(sampleCount * 0.98);
    let lowLum = 0;
    let highLum = 255;
    let acc = 0;
    for (let v = 0; v < 256; v += 1) {
      acc += hist[v];
      if (acc <= lowTarget) lowLum = v;
      if (acc >= highTarget) {
        highLum = v;
        break;
      }
    }

    const range = Math.max(45, highLum - lowLum);
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let norm = ((lum - lowLum) / range) * 255;
      norm = Math.max(0, Math.min(255, norm));
      // Mild S-curve sharpening to separate dark text from paper background
      const contrasted =
        norm < 155 ? Math.max(0, norm * 0.85) : Math.min(255, 155 + (norm - 155) * 1.15);
      const byte = Math.round(contrasted);
      data[i] = byte;
      data[i + 1] = byte;
      data[i + 2] = byte;
    }
    ocrCtx.putImageData(imageData, 0, 0);
    const ocrDataUrl = ocrCanvas.toDataURL('image/png');

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
    customFields: CustomField[];
  },
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<{
  extraction: EmployeeOcrExtraction;
  previewDataUrl: string;
  sizeLabel: string;
}> {
  onProgress?.({ status: 'Enhancing full-page clarity…', progress: 8 });
  const { ocrDataUrl, previewDataUrl, sizeLabel } =
    await preprocessImageForOcr(source);

  onProgress?.({ status: 'Loading OCR engine…', progress: 18 });
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: msg => {
      if (msg.status === 'recognizing text') {
        const pct = Math.min(96, Math.round(22 + (msg.progress || 0) * 73));
        onProgress?.({
          status: 'Scanning ID, contact, dates, address & role…',
          progress: pct,
        });
      }
    },
  });

  try {
    // PSM 6 reads across horizontal rows cleanly without splitting multi-column forms vertically
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM?.SINGLE_BLOCK ?? ('6' as never),
      preserve_interword_spaces: '1',
    });

    const result = await worker.recognize(ocrDataUrl);
    onProgress?.({ status: 'Matching priority employee fields…', progress: 99 });
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
