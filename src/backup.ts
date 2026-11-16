import JSZip from 'jszip';
import { CustomField, Employee, Group } from './types';

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

  employees.forEach(employee => {
    const person = safeName(employee.fullName || employee.employeeNumber || 'employee');

    if (employee.photo) {
      const decoded = decodeDataUrl(employee.photo);
      if (decoded) {
        const fileName = uniqueName(withExtension(`${person} - profile photo`, decoded.ext), usedPhotos);
        photoFolder!.file(fileName, decoded.bytes);
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
        counts.documents += 1;
        return;
      }
      const noteName = uniqueName(`${safeDocName}.txt`, used);
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
    exportedAt,
    counts,
    contents,
    notes: [
      'employees.json is the authoritative record; CSV files are convenience copies.',
      'Uploaded files are included where the workspace stored their contents.',
      'Backups are unencrypted and contain personal information — store securely.',
    ],
  }, null, 2));
  zip.file('README.txt', readme(counts, exportedAt));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, fileName: `peopleflow-backup-${date}.zip`, counts };
}
