import JSZip from 'jszip';
import { CustomField, Employee, EmployeeDocument, Group, WorkEntry } from './types';

interface FileRef {
  kind: 'photo' | 'document' | 'document-placeholder';
  employeeId: string;
  documentId?: string;
  path: string;
}

export interface BackupResult {
  blob: Blob;
  fileName: string;
  counts: { employees: number; groups: number; customFields: number; documents: number; photos: number };
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

const withExtension = (name: string, ext: string) => {
  const hasExtension = /\.[a-z0-9]{1,5}$/i.test(name);
  return hasExtension ? name : `${name}.${ext}`;
};

const csvValue = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const toCsv = (headers: string[], rows: unknown[][]) =>
  '\ufeff' + [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\r\n');

function employeeCsv(employees: Employee[], groups: Group[]) {
  const headers = ['Full name', 'Employee number', 'ID number', 'Job title', 'Department', 'Manager', 'Employment type', 'Status', 'Start date', 'End date', 'Email', 'Phone', 'Groups', 'Documents', 'Last updated'];
  const rows = employees.map(e => [
    e.fullName, e.employeeNumber, e.idNumber, e.jobTitle, e.department, e.manager, e.employmentType, e.status,
    e.startDate, e.endDate || '', e.email, e.phone,
    e.groups.map(id => groups.find(g => g.id === id)?.name || id).join('; '),
    e.documents.map(d => d.name).join('; '), e.lastUpdated,
  ]);
  return toCsv(headers, rows);
}

function workHistoryCsv(employees: Employee[]) {
  const headers = ['Employee', 'Employee number', 'Role', 'Project', 'Start date', 'End date', 'Description', 'Attached document'];
  const rows = employees.flatMap(e => e.workHistory.map(w => [e.fullName, e.employeeNumber, w.title, w.project, w.startDate, w.endDate || 'Present', w.description, w.document || '']));
  return toCsv(headers, rows);
}

function groupCsv(groups: Group[], employees: Employee[]) {
  const headers = ['Group', 'Description', 'Lead', 'Parent group', 'Members'];
  const rows = groups.map(g => [
    g.name, g.description, g.lead, groups.find(p => p.id === g.parentId)?.name || '',
    employees.filter(e => e.groups.includes(g.id)).map(e => e.fullName).join('; '),
  ]);
  return toCsv(headers, rows);
}

function readme(counts: BackupResult['counts'], exportedAt: string) {
  return `PEOPLEFLOW HR — FULL WORKSPACE BACKUP
=====================================

Exported: ${new Date(exportedAt).toLocaleString('en-ZA')}

Employees:      ${counts.employees}
Groups:         ${counts.groups}
Custom fields:  ${counts.customFields}
Documents:      ${counts.documents}
Photos:         ${counts.photos}

WHAT IS IN THIS ZIP
-------------------
employees.json          Complete employee records, including work history,
                        document details, custom fields, and group membership.
employees.csv           Spreadsheet-friendly employee list.
work-history.csv        Every work history entry, one row each.
groups.json             Groups, divisions, leads, and hierarchy.
groups.csv              Groups with their member lists.
custom-fields.json      Custom employee field definitions.
documents/              Uploaded files, stored per employee.
photos/                 Employee profile photos.
manifest.json           Export summary and file index.
README.txt              This file.

The JSON files hold the authoritative record. The CSV files are convenience
copies for spreadsheets and reporting.

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

export async function createWorkspaceZip(employees: Employee[], groups: Group[], customFields: CustomField[]): Promise<BackupResult> {
  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  const date = stamp();
  const counts: BackupResult['counts'] = { employees: employees.length, groups: groups.length, customFields: customFields.length, documents: 0, photos: 0 };
  const contents = ['manifest.json', 'README.txt', 'employees.json', 'employees.csv', 'work-history.csv', 'groups.json', 'groups.csv', 'custom-fields.json'];

  zip.file('employees.json', JSON.stringify(employees, null, 2));
  zip.file('employees.csv', employeeCsv(employees, groups));
  zip.file('work-history.csv', workHistoryCsv(employees));
  zip.file('groups.json', JSON.stringify(groups, null, 2));
  zip.file('groups.csv', groupCsv(groups, employees));
  zip.file('custom-fields.json', JSON.stringify(customFields, null, 2));

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
        'PEOPLEFLOW DOCUMENT RECORD',
        '',
        `Employee: ${employee.fullName} (${employee.employeeNumber})`,
        `Document: ${doc.name}`,
        `Type: ${doc.type}`,
        `Added: ${doc.date}`,
        `Size on record: ${doc.size}`,
        '',
        'No file contents were stored for this record in the workspace, so this',
        'note preserves its details instead. Upload or replace the document in',
        'Peopleflow to store the original file.',
      ].join('\n'));
    });
  });

  const documentsCreated = counts.documents > 0 || counts.photos > 0;
  if (documentsCreated) {
    contents.push('documents/', 'photos/');
  }

  zip.file('manifest.json', JSON.stringify({
    app: 'Peopleflow HR',
    formatVersion: 2,
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
  return { blob, fileName: `peopleflow-backup-${date}.zip`, counts };
}

/* ------------------------------------------------------------------ *
 * Importing a backup
 * ------------------------------------------------------------------ */

export interface WorkspaceImport {
  employees: Employee[];
  groups: Group[];
  customFields: CustomField[];
  counts: { employees: number; groups: number; customFields: number; documents: number; photos: number };
  warnings: string[];
  /** Approximate size of the restored data, used to warn about browser storage limits. */
  bytes: number;
  source: 'zip' | 'json';
}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback);
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? value as Record<string, unknown> : {});

const STATUSES = new Set(['Active', 'On leave', 'Resigned', 'Terminated']);
const EMPLOYMENT_TYPES = new Set(['Full-time', 'Part-time', 'Contract']);

function normalizeDocument(raw: unknown): EmployeeDocument | null {
  const item = record(raw);
  const name = text(item.name).trim();
  if (!name) return null;
  const data = text(item.data);
  return {
    id: text(item.id) || crypto.randomUUID(),
    name,
    type: text(item.type, 'Other'),
    date: text(item.date, new Date().toISOString().slice(0, 10)),
    size: text(item.size, '—'),
    ...(data.startsWith('data:') ? { data } : {}),
  };
}

function normalizeHistory(raw: unknown): WorkEntry | null {
  const item = record(raw);
  const title = text(item.title).trim();
  if (!title) return null;
  return {
    id: text(item.id) || crypto.randomUUID(),
    title,
    project: text(item.project),
    description: text(item.description),
    startDate: text(item.startDate),
    endDate: text(item.endDate) || undefined,
    document: text(item.document) || undefined,
  };
}

function normalizeEmployee(raw: unknown): Employee | null {
  const item = record(raw);
  const fullName = text(item.fullName).trim();
  if (!fullName) return null;
  const custom: Record<string, string> = {};
  Object.entries(record(item.custom)).forEach(([key, value]) => { custom[key] = text(value); if (typeof value === 'number') custom[key] = String(value); });
  const status = text(item.status, 'Active');
  const employmentType = text(item.employmentType, 'Full-time');
  return {
    id: text(item.id) || crypto.randomUUID(),
    fullName,
    idNumber: text(item.idNumber),
    employeeNumber: text(item.employeeNumber),
    dob: text(item.dob),
    phone: text(item.phone),
    email: text(item.email),
    address: text(item.address),
    emergencyName: text(item.emergencyName),
    emergencyPhone: text(item.emergencyPhone),
    jobTitle: text(item.jobTitle),
    department: text(item.department),
    manager: text(item.manager),
    employmentType: (EMPLOYMENT_TYPES.has(employmentType) ? employmentType : 'Full-time') as Employee['employmentType'],
    startDate: text(item.startDate),
    status: (STATUSES.has(status) ? status : 'Active') as Employee['status'],
    endDate: text(item.endDate) || undefined,
    photo: text(item.photo) || undefined,
    bio: text(item.bio),
    skills: text(item.skills),
    languages: text(item.languages),
    custom,
    groups: list(item.groups).map(id => text(id)).filter(Boolean),
    workHistory: list(item.workHistory).map(normalizeHistory).filter((entry): entry is WorkEntry => Boolean(entry)),
    documents: list(item.documents).map(normalizeDocument).filter((doc): doc is EmployeeDocument => Boolean(doc)),
    lastUpdated: text(item.lastUpdated, new Date().toISOString()),
  };
}

function normalizeGroup(raw: unknown): Group | null {
  const item = record(raw);
  const name = text(item.name).trim();
  if (!name) return null;
  return {
    id: text(item.id) || crypto.randomUUID(),
    name,
    description: text(item.description),
    lead: text(item.lead),
    parentId: text(item.parentId) || undefined,
    color: text(item.color, '#6d5bd0'),
  };
}

function normalizeField(raw: unknown): CustomField | null {
  const item = record(raw);
  const label = text(item.label).trim();
  if (!label) return null;
  const type = text(item.type, 'Text');
  return {
    id: text(item.id) || crypto.randomUUID(),
    label,
    type: (['Text', 'Date', 'Number'].includes(type) ? type : 'Text') as CustomField['type'],
  };
}

function parseData(raw: unknown): { employees: Employee[]; groups: Group[]; customFields: CustomField[]; warnings: string[] } {
  const data = Array.isArray(raw) ? { employees: raw, groups: [], customFields: [] } : record(raw);
  const employeeList = list(data.employees).map(normalizeEmployee).filter((employee): employee is Employee => Boolean(employee));
  if (!list(data.employees).length && !employeeList.length && !Array.isArray(data.employees)) {
    throw new Error('This backup does not contain employee data.');
  }
  const dropped = list(data.employees).length - employeeList.length;
  const warnings: string[] = [];
  if (dropped > 0) warnings.push(`${dropped} incomplete employee record${dropped === 1 ? '' : 's'} were skipped.`);
  return {
    employees: employeeList,
    groups: list(data.groups).map(normalizeGroup).filter((group): group is Group => Boolean(group)),
    customFields: list(data.customFields).map(normalizeField).filter((field): field is CustomField => Boolean(field)),
    warnings,
  };
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', csv: 'text/csv', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const mimeFor = (path: string) => MIME_BY_EXTENSION[path.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
const baseName = (path: string) => path.split('/').pop() || path;
const comparable = (name: string) => baseName(name)
  .toLowerCase()
  .replace(/\.[a-z0-9]{1,5}$/i, '')
  .replace(/\(\d+\)$/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

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

  if (looksJson) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('That JSON file could not be read as a backup.'); }
    const { employees, groups, customFields, warnings } = parseData(parsed);
    const bytes = employees.reduce((total, employee) => total + (employee.photo?.length || 0) + employee.documents.reduce((sum, doc) => sum + (doc.data?.length || 0), 0), 0);
    return { employees, groups, customFields, counts: summarize(employees, groups, customFields), warnings, bytes, source: 'json' };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch {
      throw new Error('That file is not a Peopleflow backup. Choose the .zip file created by Export → Full backup.');
    }
    const { employees, groups, customFields, warnings } = parseData(parsed);
    const bytes = employees.reduce((total, employee) => total + (employee.photo?.length || 0) + employee.documents.reduce((sum, doc) => sum + (doc.data?.length || 0), 0), 0);
    return { employees, groups, customFields, counts: summarize(employees, groups, customFields), warnings, bytes, source: 'json' };
  }

  const entries = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => { if (!entry.dir) entries.set(path.toLowerCase(), entry); });
  const find = (name: string) => {
    const exact = entries.get(name.toLowerCase());
    if (exact) return exact;
    for (const [path, entry] of entries) if (path.endsWith(`/${name.toLowerCase()}`)) return entry;
    return undefined;
  };

  const employeeEntry = find('employees.json');
  if (!employeeEntry) {
    const legacy = find('peopleflow-backup.json');
    if (!legacy) throw new Error('This ZIP has no employees.json, so it is not a Peopleflow backup.');
    let parsed: unknown;
    try { parsed = JSON.parse(await legacy.async('string')); } catch { throw new Error('The employee data inside this ZIP could not be read.'); }
    const { employees, groups, customFields, warnings } = parseData(parsed);
    return { employees, groups, customFields, counts: summarize(employees, groups, customFields), warnings, bytes: 0, source: 'zip' };
  }

  let rawEmployees: unknown;
  try { rawEmployees = JSON.parse(await employeeEntry.async('string')); } catch { throw new Error('The employee data inside this ZIP could not be read.'); }
  const groupsEntry = find('groups.json');
  const fieldsEntry = find('custom-fields.json');
  const readJson = async (entry?: JSZip.JSZipObject) => {
    if (!entry) return undefined;
    try { return JSON.parse(await entry.async('string')); } catch { return undefined; }
  };
  const { employees, groups, customFields, warnings } = parseData({
    employees: rawEmployees,
    groups: await readJson(groupsEntry) ?? [],
    customFields: await readJson(fieldsEntry) ?? [],
  });

  let manifest: Record<string, unknown> | undefined;
  const manifestEntry = find('manifest.json');
  if (manifestEntry) {
    try { manifest = record(JSON.parse(await manifestEntry.async('string'))); } catch { manifest = undefined; }
  }

  const fileRefs = list(manifest?.files).map(record);
  const photosByEmployee = new Map<string, JSZip.JSZipObject>();
  const documentsByKey = new Map<string, JSZip.JSZipObject>();
  fileRefs.forEach(ref => {
    const employeeId = text(ref.employeeId);
    const path = text(ref.path);
    if (!employeeId || !path) return;
    if (ref.kind === 'photo') {
      const entry = entries.get(path.toLowerCase());
      if (entry) photosByEmployee.set(employeeId, entry);
    }
    if (ref.kind === 'document') {
      const documentId = text(ref.documentId);
      const entry = entries.get(path.toLowerCase());
      if (documentId && entry) documentsByKey.set(`${employeeId}:${documentId}`, entry);
    }
  });

  let bytes = 0;
  let restoredFiles = 0;
  let missingFiles = 0;
  const photoPaths = new Set<string>();
  const documentPaths = new Set<string>();

  for (const employee of employees) {
    let photoEntry = photosByEmployee.get(employee.id);
    if (!photoEntry) {
      const folderPrefix = `photos/${safeName(employee.fullName).toLowerCase()}`;
      for (const [path, entry] of entries) {
        if (path.startsWith(folderPrefix) && !photoPaths.has(path)) { photoEntry = entry; break; }
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
      if (!entry) { missingFiles += 1; continue; }
      if (documentPaths.has(entry.name.toLowerCase())) { missingFiles += 1; continue; }
      if (/\.txt$/i.test(entry.name) && !/\.txt$/i.test(doc.name)) { missingFiles += 1; continue; }
      documentPaths.add(entry.name.toLowerCase());
      const { dataUrl, bytes: size } = await dataUrlFor(entry, entry.name);
      doc.data = dataUrl;
      bytes += size;
      restoredFiles += 1;
    }
  }

  const counts = summarize(employees, groups, customFields);
  if (missingFiles > 0) warnings.push(`${missingFiles} document record${missingFiles === 1 ? '' : 's'} will keep ${missingFiles === 1 ? 'its' : 'their'} details only — no stored file was included.`);
  if (!restoredFiles) warnings.push('No stored documents or photos were found in this ZIP.');

  return { employees, groups, customFields, counts, warnings, bytes, source: 'zip' };
}

function summarize(employees: Employee[], groups: Group[], customFields: CustomField[]): WorkspaceImport['counts'] {
  return {
    employees: employees.length,
    groups: groups.length,
    customFields: customFields.length,
    documents: employees.reduce((total, employee) => total + employee.documents.filter(doc => doc.data).length, 0),
    photos: employees.filter(employee => employee.photo).length,
  };
}
