import JSZip from 'jszip';
import { Branch, CustomField, Employee, EmployeeDocument, LeaveRequest, LeaveStatus, LeaveType, Payslip, TimeEntry, Warning, WarningCategory, WarningSeverity, WorkEntry } from './types';
import { workedHours } from './time';

interface FileRef {
  kind: 'photo' | 'document' | 'document-placeholder';
  employeeId: string;
  documentId?: string;
  path: string;
}

export interface BackupCounts {
  employees: number;
  branches: number;
  customFields: number;
  documents: number;
  photos: number;
  timeEntries: number;
  leaveRequests: number;
  payslips: number;
  warnings: number;
}

export interface BackupResult {
  blob: Blob;
  fileName: string;
  counts: BackupCounts;
}

const pad = (value: number) => String(value).padStart(2, '0');
const stamp = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const safeName = (value: string, fallback = 'file') => {
  const cleaned = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  return (cleaned || fallback).slice(0, 90);
};

const uniqueName = (name: string, used: Set<string>) => {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  let index = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base} (${index++})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', csv: 'text/csv', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  const ext = MIME_EXTENSIONS[mime.toLowerCase()] || (mime.split('/')[1] || '').replace(/[^a-z0-9]/gi, '') || 'bin';
  try {
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, ext };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), ext };
  } catch {
    return null;
  }
}

const withExtension = (name: string, ext: string) => (/\.[a-z0-9]{1,5}$/i.test(name) ? name : `${name}.${ext}`);
const mimeFor = (path: string) => MIME_BY_EXTENSION[path.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
const baseName = (path: string) => path.split('/').pop() || path;
const comparable = (name: string) => baseName(name)
  .toLowerCase()
  .replace(/\.[a-z0-9]{1,5}$/i, '')
  .replace(/\(\d+\)$/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const csvValue = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const toCsv = (headers: string[], rows: unknown[][]) => '\ufeff' + [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\r\n');
const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function employeeCsv(employees: Employee[], branches: Branch[]) {
  const headers = ['Full name', 'Employee number', 'ID number', 'Job title', 'Department', 'Branch', 'Manager', 'Employment type', 'Status', 'Start date', 'End date', 'Email', 'Phone', 'Monthly salary', 'Documents', 'Last updated'];
  return toCsv(headers, employees.map(employee => [
    employee.fullName, employee.employeeNumber, employee.idNumber, employee.jobTitle, employee.department,
    branches.find(branch => branch.id === employee.branchId)?.name || '', employee.manager, employee.employmentType,
    employee.status, employee.startDate, employee.endDate || '', employee.email, employee.phone, employee.monthlySalary || 0,
    employee.documents.map(doc => doc.name).join('; '), employee.lastUpdated,
  ]));
}

function workHistoryCsv(employees: Employee[]) {
  const headers = ['Employee', 'Employee number', 'Role', 'Project', 'Start date', 'End date', 'Description', 'Attached document'];
  return toCsv(headers, employees.flatMap(employee => employee.workHistory.map(entry => [employee.fullName, employee.employeeNumber, entry.title, entry.project, entry.startDate, entry.endDate || 'Present', entry.description, entry.document || ''])));
}

function branchCsv(branches: Branch[], employees: Employee[]) {
  const headers = ['Branch', 'Description', 'Lead', 'Members'];
  return toCsv(headers, branches.map(branch => [branch.name, branch.description, branch.lead, employees.filter(employee => employee.branchId === branch.id).map(employee => employee.fullName).join('; ')]));
}

function timesheetCsv(entries: TimeEntry[], employees: Employee[], branches: Branch[]) {
  const headers = ['Employee', 'Employee number', 'Branch', 'Date', 'Clock in', 'Clock out', 'Break (minutes)', 'Hours', 'Status', 'Source', 'Notes'];
  return toCsv(headers, entries.map(entry => {
    const employee = employees.find(person => person.id === entry.employeeId);
    return [employee?.fullName || '', employee?.employeeNumber || '', branches.find(branch => branch.id === employee?.branchId)?.name || '', entry.date, entry.clockIn, entry.clockOut || '', entry.breakMinutes, workedHours(entry).toFixed(2), entry.approved ? 'Approved' : 'Pending', entry.source, entry.notes || ''];
  }));
}

function leaveCsv(requests: LeaveRequest[], employees: Employee[]) {
  const headers = ['Employee', 'Employee number', 'Leave type', 'From', 'To', 'Working days', 'Reason', 'Status', 'Requested'];
  return toCsv(headers, requests.map(request => {
    const employee = employees.find(person => person.id === request.employeeId);
    return [employee?.fullName || '', employee?.employeeNumber || '', request.type, request.startDate, request.endDate, request.days, request.reason, request.status, request.requestedAt];
  }));
}

function payslipCsv(payslips: Payslip[], employees: Employee[], branches: Branch[]) {
  const headers = ['Employee', 'Employee number', 'Branch', 'Period', 'Pay date', 'Gross', 'Overtime', 'Allowances', 'PAYE', 'UIF employee', 'UIF employer', 'Other deductions', 'Net pay'];
  return toCsv(headers, payslips.map(slip => {
    const employee = employees.find(person => person.id === slip.employeeId);
    return [employee?.fullName || '', employee?.employeeNumber || '', branches.find(branch => branch.id === employee?.branchId)?.name || '', slip.period, slip.payDate, slip.gross.toFixed(2), slip.overtime.toFixed(2), slip.allowances.toFixed(2), slip.paye.toFixed(2), slip.uifEmployee.toFixed(2), slip.uifEmployer.toFixed(2), slip.deductions.toFixed(2), slip.net.toFixed(2)];
  }));
}

function warningCsv(warnings: Warning[], employees: Employee[]) {
  const headers = ['Employee', 'Employee number', 'Category', 'Level', 'Issued on', 'Issued by', 'Details', 'Acknowledged'];
  return toCsv(headers, warnings.map(warning => {
    const employee = employees.find(person => person.id === warning.employeeId);
    return [employee?.fullName || '', employee?.employeeNumber || '', warning.category === 'Custom' ? warning.customCategory || 'Custom' : warning.category, warning.severity, warning.issuedDate, warning.issuedBy, warning.details, warning.acknowledged ? 'Yes' : 'No'];
  }));
}

function readme(counts: BackupCounts, exportedAt: string) {
  return `PEOPLEFLOW HR — FULL WORKSPACE BACKUP
=====================================

Exported: ${new Date(exportedAt).toLocaleString('en-ZA')}

Employees:      ${counts.employees}
Branches:       ${counts.branches}
Custom fields:  ${counts.customFields}
Time entries:   ${counts.timeEntries}
Leave requests: ${counts.leaveRequests}
Payslips:       ${counts.payslips}
Warnings:       ${counts.warnings}
Documents:      ${counts.documents}
Photos:         ${counts.photos}

WHAT IS IN THIS ZIP
-------------------
employees.json          Complete employee records, including work history,
                        documents, custom fields, branch, and salary.
employees.csv           Spreadsheet-friendly employee list.
work-history.csv        Every work history entry, one row each.
branches.json           Branches with leads and descriptions.
branches.csv            Branches with their member lists.
custom-fields.json      Custom employee field definitions.
timesheets.json         Clocking sessions with hours and approval state.
timesheets.csv          Clocking sessions for spreadsheets.
leave-requests.json     Leave requests with status and working days.
leave-requests.csv      Leave requests for spreadsheets.
payslips.json           Generated payslips with UIF and PAYE amounts.
payslips.csv            Payslips for spreadsheets.
warnings.json           Warning records by category and level.
warnings.csv            Warning records for spreadsheets.
documents/              Uploaded files, stored per employee.
photos/                 Employee profile photos.
manifest.json           Export summary and file index.
README.txt              This file.

The JSON files are the authoritative record and are what Import reads. The
CSV files are convenience copies for spreadsheets and reporting.

This archive contains workspace data only. Your application code, build
files, and settings are never included, and importing it only restores the
records listed above.

ABOUT DOCUMENTS
---------------
Files uploaded in this browser are included here as their original files.
Records that only reference a filename (for example older sample records)
are saved as a short .txt note explaining that no file was stored.

This backup is unencrypted. It contains personal and sensitive employee
information — store it securely and share it only with authorised HR users.
`;
}

export async function createWorkspaceZip(
  employees: Employee[],
  branches: Branch[],
  customFields: CustomField[],
  timeEntries: TimeEntry[],
  leaveRequests: LeaveRequest[],
  payslips: Payslip[],
  warnings: Warning[],
): Promise<BackupResult> {
  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  const counts: BackupCounts = {
    employees: employees.length, branches: branches.length, customFields: customFields.length,
    documents: 0, photos: 0, timeEntries: timeEntries.length, leaveRequests: leaveRequests.length,
    payslips: payslips.length, warnings: warnings.length,
  };
  const contents = [
    'manifest.json', 'README.txt', 'employees.json', 'employees.csv', 'work-history.csv',
    'branches.json', 'branches.csv', 'custom-fields.json', 'timesheets.json', 'timesheets.csv',
    'leave-requests.json', 'leave-requests.csv', 'payslips.json', 'payslips.csv', 'warnings.json', 'warnings.csv',
  ];

  zip.file('employees.json', JSON.stringify(employees, null, 2));
  zip.file('employees.csv', employeeCsv(employees, branches));
  zip.file('work-history.csv', workHistoryCsv(employees));
  zip.file('branches.json', JSON.stringify(branches, null, 2));
  zip.file('branches.csv', branchCsv(branches, employees));
  zip.file('custom-fields.json', JSON.stringify(customFields, null, 2));
  zip.file('timesheets.json', JSON.stringify(timeEntries, null, 2));
  zip.file('timesheets.csv', timesheetCsv(timeEntries, employees, branches));
  zip.file('leave-requests.json', JSON.stringify(leaveRequests, null, 2));
  zip.file('leave-requests.csv', leaveCsv(leaveRequests, employees));
  zip.file('payslips.json', JSON.stringify(payslips, null, 2));
  zip.file('payslips.csv', payslipCsv(payslips, employees, branches));
  zip.file('warnings.json', JSON.stringify(warnings, null, 2));
  zip.file('warnings.csv', warningCsv(warnings, employees));

  const photoFolder = zip.folder('photos');
  const documentFolder = zip.folder('documents');
  const usedPhotos = new Set<string>();
  const usedDocuments = new Map<string, Set<string>>();
  const files: FileRef[] = [];

  employees.forEach(employee => {
    const person = safeName(employee.fullName || employee.employeeNumber || 'employee');

    if (employee.photo) {
      const decoded = decodeDataUrl(employee.photo);
      if (decoded) {
        const fileName = uniqueName(withExtension(`${person} - profile photo`, decoded.ext), usedPhotos);
        photoFolder!.file(fileName, decoded.bytes);
        files.push({ kind: 'photo', employeeId: employee.id, path: `photos/${fileName}` });
        counts.photos += 1;
      }
    }

    const documents = employee.documents || [];
    if (!documents.length) return;
    const folder = documentFolder!.folder(person);
    if (!folder) return;
    if (!usedDocuments.has(person)) usedDocuments.set(person, new Set());
    const used = usedDocuments.get(person)!;

    documents.forEach(doc => {
      const safeDocName = safeName(doc.name || 'document');
      const decoded = doc.data ? decodeDataUrl(doc.data) : null;
      if (decoded) {
        const fileName = uniqueName(withExtension(safeDocName, decoded.ext), used);
        folder.file(fileName, decoded.bytes);
        files.push({ kind: 'document', employeeId: employee.id, documentId: doc.id, path: `documents/${person}/${fileName}` });
        counts.documents += 1;
        return;
      }
      const noteName = uniqueName(`${safeDocName}.txt`, used);
      files.push({ kind: 'document-placeholder', employeeId: employee.id, documentId: doc.id, path: `documents/${person}/${noteName}` });
      folder.file(noteName, [
        'PEOPLEFLOW DOCUMENT RECORD', '',
        `Employee: ${employee.fullName} (${employee.employeeNumber})`,
        `Document: ${doc.name}`, `Type: ${doc.type}`, `Added: ${doc.date}`, `Size on record: ${doc.size}`, '',
        'No file contents were stored for this record in the workspace, so this',
        'note preserves its details instead. Upload or replace the document in',
        'Peopleflow to store the original file.',
      ].join('\n'));
    });
  });

  if (counts.documents || counts.photos) contents.push('documents/', 'photos/');

  zip.file('manifest.json', JSON.stringify({
    app: 'Peopleflow HR',
    formatVersion: 3,
    dataOnly: true,
    exportedAt,
    counts,
    contents,
    files,
    notes: [
      'employees.json is the authoritative record; CSV files are convenience copies.',
      'Uploaded files are included where the workspace stored their contents.',
      'This archive contains workspace data only — the application itself is never exported.',
      'Backups are unencrypted and contain personal information — store securely.',
    ],
  }, null, 2));
  zip.file('README.txt', readme(counts, exportedAt));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, fileName: `peopleflow-backup-${stamp()}.zip`, counts };
}

/* ------------------------------------------------------------------ *
 * Importing a backup
 * ------------------------------------------------------------------ */

export interface WorkspaceImport {
  employees: Employee[];
  branches: Branch[];
  customFields: CustomField[];
  timeEntries: TimeEntry[];
  leaveRequests: LeaveRequest[];
  payslips: Payslip[];
  warnings: Warning[];
  counts: BackupCounts;
  /** Import notes and skipped-record messages. */
  notices: string[];
  bytes: number;
  source: 'zip' | 'json';
}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const num = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const bool = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const STATUSES = new Set(['Active', 'On leave', 'Resigned', 'Terminated']);
const EMPLOYMENT_TYPES = new Set(['Full-time', 'Part-time', 'Contract']);
const LEAVE_TYPES = new Set(['Annual', 'Sick', 'Family responsibility', 'Unpaid', 'Maternity']);
const LEAVE_STATUSES = new Set(['Pending', 'Approved', 'Declined']);
const WARNING_CATEGORIES = new Set(['Attendance & time', 'Conduct', 'Duty related', 'Property', 'Substances', 'Custom']);
const WARNING_SEVERITIES = new Set(['Verbal', 'Written', 'Final']);

function normalizeDocument(raw: unknown): EmployeeDocument | null {
  const item = record(raw);
  const name = text(item.name).trim();
  if (!name) return null;
  const data = text(item.data);
  return {
    id: text(item.id) || crypto.randomUUID(), name,
    type: text(item.type, 'Other'), date: text(item.date, new Date().toISOString().slice(0, 10)),
    size: text(item.size, '—'), ...(data.startsWith('data:') ? { data } : {}),
  };
}

function normalizeHistory(raw: unknown): WorkEntry | null {
  const item = record(raw);
  const title = text(item.title).trim();
  if (!title) return null;
  return {
    id: text(item.id) || crypto.randomUUID(), title, project: text(item.project),
    description: text(item.description), startDate: text(item.startDate),
    endDate: text(item.endDate) || undefined, document: text(item.document) || undefined,
  };
}

function normalizeEmployee(raw: unknown): Employee | null {
  const item = record(raw);
  const fullName = text(item.fullName).trim();
  if (!fullName) return null;
  const custom: Record<string, string> = {};
  Object.entries(record(item.custom)).forEach(([key, value]) => { custom[key] = text(value); });
  const status = text(item.status, 'Active');
  const employmentType = text(item.employmentType, 'Full-time');
  const legacyGroups = list(item.groups).map(value => text(value)).filter(Boolean);
  const branchId = text(item.branchId) || legacyGroups[0] || undefined;
  return {
    id: text(item.id) || crypto.randomUUID(), fullName,
    idNumber: text(item.idNumber), employeeNumber: text(item.employeeNumber), dob: text(item.dob),
    phone: text(item.phone), email: text(item.email), address: text(item.address),
    emergencyName: text(item.emergencyName), emergencyPhone: text(item.emergencyPhone),
    jobTitle: text(item.jobTitle), department: text(item.department), manager: text(item.manager),
    employmentType: (EMPLOYMENT_TYPES.has(employmentType) ? employmentType : 'Full-time') as Employee['employmentType'],
    startDate: text(item.startDate),
    status: (STATUSES.has(status) ? status : 'Active') as Employee['status'],
    endDate: text(item.endDate) || undefined,
    photo: text(item.photo) || undefined,
    bio: text(item.bio), skills: text(item.skills), languages: text(item.languages), custom,
    branchId,
    monthlySalary: num(item.monthlySalary, 0),
    workHistory: list(item.workHistory).map(normalizeHistory).filter((entry): entry is WorkEntry => Boolean(entry)),
    documents: list(item.documents).map(normalizeDocument).filter((doc): doc is EmployeeDocument => Boolean(doc)),
    lastUpdated: text(item.lastUpdated, new Date().toISOString()),
  };
}

function normalizeBranch(raw: unknown): Branch | null {
  const item = record(raw);
  const name = text(item.name).trim();
  if (!name) return null;
  return {
    id: text(item.id) || crypto.randomUUID(), name,
    description: text(item.description), lead: text(item.lead), color: text(item.color, '#6d5bd0'),
  };
}

function normalizeField(raw: unknown): CustomField | null {
  const item = record(raw);
  const label = text(item.label).trim();
  if (!label) return null;
  const type = text(item.type, 'Text');
  return { id: text(item.id) || crypto.randomUUID(), label, type: (['Text', 'Date', 'Number'].includes(type) ? type : 'Text') as CustomField['type'] };
}

function normalizeTimeEntry(raw: unknown): TimeEntry | null {
  const item = record(raw);
  const employeeId = text(item.employeeId);
  const date = text(item.date);
  const clockIn = text(item.clockIn);
  if (!employeeId || !date || !clockIn) return null;
  return {
    id: text(item.id) || crypto.randomUUID(), employeeId, date, clockIn,
    clockOut: text(item.clockOut) || undefined,
    breakMinutes: Math.max(0, num(item.breakMinutes, 0)),
    notes: text(item.notes),
    approved: bool(item.approved),
    source: text(item.source) === 'Clock' ? 'Clock' : 'Manual',
  };
}

function normalizeLeave(raw: unknown): LeaveRequest | null {
  const item = record(raw);
  const employeeId = text(item.employeeId);
  const startDate = text(item.startDate);
  const endDate = text(item.endDate, startDate);
  if (!employeeId || !startDate) return null;
  const type = text(item.type, 'Annual');
  const status = text(item.status, 'Pending');
  return {
    id: text(item.id) || crypto.randomUUID(), employeeId,
    type: (LEAVE_TYPES.has(type) ? type : 'Annual') as LeaveType,
    startDate, endDate,
    days: Math.max(1, num(item.days, 1)),
    reason: text(item.reason),
    status: (LEAVE_STATUSES.has(status) ? status : 'Pending') as LeaveStatus,
    requestedAt: text(item.requestedAt, new Date().toISOString()),
  };
}

function normalizePayslip(raw: unknown): Payslip | null {
  const item = record(raw);
  const employeeId = text(item.employeeId);
  const period = text(item.period);
  if (!employeeId || !period) return null;
  const gross = round(num(item.gross));
  const paye = round(num(item.paye));
  const uifEmployee = round(num(item.uifEmployee));
  const deductions = round(num(item.deductions));
  const includeUif = bool(item.includeUif, uifEmployee > 0);
  return {
    id: text(item.id) || crypto.randomUUID(), employeeId, period,
    payDate: text(item.payDate, `${period}-01`),
    gross, overtime: round(num(item.overtime)), allowances: round(num(item.allowances)),
    deductions, paye, uifEmployee,
    uifEmployer: round(num(item.uifEmployer, uifEmployee)),
    includeUif,
    net: round(num(item.net, gross - paye - uifEmployee - deductions)),
    notes: text(item.notes), createdAt: text(item.createdAt, new Date().toISOString()),
  };
}

function normalizeWarning(raw: unknown): Warning | null {
  const item = record(raw);
  const employeeId = text(item.employeeId);
  if (!employeeId) return null;
  const category = text(item.category, 'Custom');
  const severity = text(item.severity, 'Verbal');
  return {
    id: text(item.id) || crypto.randomUUID(), employeeId,
    category: (WARNING_CATEGORIES.has(category) ? category : 'Custom') as WarningCategory,
    customCategory: (WARNING_CATEGORIES.has(category) ? text(item.customCategory) : text(item.customCategory, category)) || undefined,
    severity: (WARNING_SEVERITIES.has(severity) ? severity : 'Verbal') as WarningSeverity,
    issuedDate: text(item.issuedDate, new Date().toISOString().slice(0, 10)),
    details: text(item.details), issuedBy: text(item.issuedBy), acknowledged: bool(item.acknowledged),
  };
}

function parseData(raw: unknown) {
  const data = Array.isArray(raw) ? { employees: raw } : record(raw);
  const rawEmployees = list(data.employees);
  if (rawEmployees.length === 0 && data.employees !== undefined && !Array.isArray(data.employees)) {
    throw new Error('This backup does not contain employee data.');
  }
  const employees = rawEmployees.map(normalizeEmployee).filter((employee): employee is Employee => Boolean(employee));
  const employeeIds = new Set(employees.map(employee => employee.id));
  const branches = list(data.branches ?? data.groups).map(normalizeBranch).filter((branch): branch is Branch => Boolean(branch));
  const customFields = list(data.customFields).map(normalizeField).filter((field): field is CustomField => Boolean(field));
  const timeEntries = list(data.timeEntries).map(normalizeTimeEntry).filter((entry): entry is TimeEntry => Boolean(entry)).filter(entry => employeeIds.has(entry.employeeId));
  const leaveRequests = list(data.leaveRequests).map(normalizeLeave).filter((request): request is LeaveRequest => Boolean(request)).filter(request => employeeIds.has(request.employeeId));
  const payslips = list(data.payslips).map(normalizePayslip).filter((slip): slip is Payslip => Boolean(slip)).filter(slip => employeeIds.has(slip.employeeId));
  const warnings = list(data.warnings).map(normalizeWarning).filter((warning): warning is Warning => Boolean(warning)).filter(warning => employeeIds.has(warning.employeeId));
  const dropped = rawEmployees.length - employees.length;
  const notices: string[] = [];
  if (dropped > 0) notices.push(`${dropped} incomplete employee record${dropped === 1 ? '' : 's'} were skipped.`);
  return { employees, branches, customFields, timeEntries, leaveRequests, payslips, warnings, notices };
}

const summarize = (data: Omit<WorkspaceImport, 'counts' | 'notices' | 'bytes' | 'source'>): BackupCounts => ({
  employees: data.employees.length,
  branches: data.branches.length,
  customFields: data.customFields.length,
  documents: data.employees.reduce((total, employee) => total + employee.documents.filter(doc => doc.data).length, 0),
  photos: data.employees.filter(employee => employee.photo).length,
  timeEntries: data.timeEntries.length,
  leaveRequests: data.leaveRequests.length,
  payslips: data.payslips.length,
  warnings: data.warnings.length,
});

const sizeOf = (data: { employees: Employee[] }) =>
  data.employees.reduce((total, employee) => total + (employee.photo?.length || 0) + employee.documents.reduce((sum, doc) => sum + (doc.data?.length || 0), 0), 0);

async function dataUrlFor(entry: JSZip.JSZipObject, path: string) {
  const base64 = await entry.async('base64');
  return { dataUrl: `data:${mimeFor(path)};base64,${base64}`, bytes: base64.length };
}

function matchInFolder(entries: Map<string, JSZip.JSZipObject>, folder: string, wanted: string) {
  const target = comparable(wanted);
  if (!target) return undefined;
  let loose: JSZip.JSZipObject | undefined;
  for (const [path, entry] of entries) {
    if (!path.startsWith(folder.toLowerCase())) continue;
    const candidate = comparable(path);
    if (candidate === target) return entry;
    if (!loose && (candidate.startsWith(target) || target.startsWith(candidate))) loose = entry;
  }
  return loose;
}

export async function readWorkspaceBackup(file: File): Promise<WorkspaceImport> {
  if (!file.size) throw new Error('That file is empty.');
  const looksJson = /\.json$/i.test(file.name) || file.type === 'application/json';

  const fromJson = async (raw: unknown, source: 'zip' | 'json'): Promise<WorkspaceImport> => {
    const parsed = parseData(raw);
    return { ...parsed, counts: summarize(parsed), bytes: sizeOf(parsed), source };
  };

  if (looksJson) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('That JSON file could not be read as a backup.'); }
    return fromJson(parsed, 'json');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch {
      throw new Error('That file is not a Peopleflow backup. Choose the .zip file created by Export → Full backup.');
    }
    return fromJson(parsed, 'json');
  }

  const entries = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => { if (!entry.dir) entries.set(path.toLowerCase(), entry); });
  const find = (name: string) => {
    const exact = entries.get(name.toLowerCase());
    if (exact) return exact;
    for (const [path, entry] of entries) if (path.endsWith(`/${name.toLowerCase()}`)) return entry;
    return undefined;
  };
  const readJson = async (name: string) => {
    const entry = find(name);
    if (!entry) return undefined;
    try { return JSON.parse(await entry.async('string')); } catch { return undefined; }
  };

  const employeeEntry = find('employees.json');
  if (!employeeEntry) {
    const legacy = await readJson('peopleflow-backup.json');
    if (!legacy) throw new Error('This ZIP has no employees.json, so it is not a Peopleflow backup.');
    return fromJson(legacy, 'zip');
  }

  let employeesRaw: unknown;
  try { employeesRaw = JSON.parse(await employeeEntry.async('string')); } catch { throw new Error('The employee data inside this ZIP could not be read.'); }

  const parsed = parseData({
    employees: employeesRaw,
    branches: await readJson('branches.json') ?? await readJson('groups.json') ?? [],
    customFields: await readJson('custom-fields.json') ?? [],
    timeEntries: await readJson('timesheets.json') ?? await readJson('time-entries.json') ?? [],
    leaveRequests: await readJson('leave-requests.json') ?? [],
    payslips: await readJson('payslips.json') ?? [],
    warnings: await readJson('warnings.json') ?? [],
  });

  let manifest: Record<string, unknown> | undefined;
  const manifestRaw = await readJson('manifest.json');
  if (manifestRaw) manifest = record(manifestRaw);

  const fileRefs = list(manifest?.files).map(record);
  const photosByEmployee = new Map<string, JSZip.JSZipObject>();
  const documentsByKey = new Map<string, JSZip.JSZipObject>();
  fileRefs.forEach(ref => {
    const employeeId = text(ref.employeeId);
    const path = text(ref.path);
    if (!employeeId || !path) return;
    const entry = entries.get(path.toLowerCase());
    if (!entry) return;
    if (ref.kind === 'photo') photosByEmployee.set(employeeId, entry);
    if (ref.kind === 'document') {
      const documentId = text(ref.documentId);
      if (documentId) documentsByKey.set(`${employeeId}:${documentId}`, entry);
    }
  });

  let bytes = 0;
  let restoredFiles = 0;
  let missingFiles = 0;
  const photoPaths = new Set<string>();
  const documentPaths = new Set<string>();

  for (const employee of parsed.employees) {
    let photoEntry = photosByEmployee.get(employee.id);
    if (!photoEntry) {
      const prefix = `photos/${safeName(employee.fullName).toLowerCase()}`;
      for (const [path, entry] of entries) {
        if (path.startsWith(prefix) && !photoPaths.has(path)) { photoEntry = entry; break; }
      }
    }
    if (photoEntry) {
      photoPaths.add(photoEntry.name.toLowerCase());
      const { dataUrl, bytes: size } = await dataUrlFor(photoEntry, photoEntry.name);
      employee.photo = dataUrl;
      bytes += size;
      restoredFiles += 1;
    }

    const folderPrefix = `documents/${safeName(employee.fullName).toLowerCase()}/`;
    for (const doc of employee.documents) {
      let entry = documentsByKey.get(`${employee.id}:${doc.id}`);
      if (!entry) entry = matchInFolder(entries, folderPrefix, doc.name);
      if (!entry || documentPaths.has(entry.name.toLowerCase()) || (/\.txt$/i.test(entry.name) && !/\.txt$/i.test(doc.name))) { missingFiles += 1; continue; }
      documentPaths.add(entry.name.toLowerCase());
      const { dataUrl, bytes: size } = await dataUrlFor(entry, entry.name);
      doc.data = dataUrl;
      bytes += size;
      restoredFiles += 1;
    }
  }

  const importNotes = [...parsed.notices];
  if (missingFiles > 0) importNotes.push(`${missingFiles} document record${missingFiles === 1 ? '' : 's'} will keep ${missingFiles === 1 ? 'its' : 'their'} details only — no stored file was included.`);
  if (parsed.employees.length && !restoredFiles) importNotes.push('No stored documents or photos were found in this ZIP.');

  const data = { employees: parsed.employees, branches: parsed.branches, customFields: parsed.customFields, timeEntries: parsed.timeEntries, leaveRequests: parsed.leaveRequests, payslips: parsed.payslips, warnings: parsed.warnings };
  return { ...data, counts: summarize(data), notices: importNotes, bytes, source: 'zip' };
}
