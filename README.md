# Peopleflow HR

A private, organised employee tracking workspace for HR teams. Built with React, TypeScript, and Vite.

## Run locally

```bash
npm install
npm run dev
```

## Included

- Dashboard with workforce metrics, departments, recent hires, and leave
- Searchable/filterable employee directory and CSV exports
- Branches (Ekurhuleni, Joburg, Tshwane) with leads and member assignment
- Timesheets with clocking sessions, automatic hours, editing, and weekly approval
- Attendance with daily clock-in/out, branch filters, and leave awareness
- Leave requests with working-day counts, approval, and decline
- Payslips from monthly salary, optional UIF (1% employee + employer, capped), manual PAYE, and printable payslips
- Warnings by category — attendance & time, conduct, duty related, property, substances, and custom warnings
- Complete employee registration and editing
- Personal, employment, emergency, and custom information
- Masked ID numbers, employee photos, and profile update timestamps
- Chronological work history and scope-of-work records
- Document upload, replacement, opening, and removal
- Resignation/termination offboarding and reactivation
- Global custom employee fields and full ZIP workspace backups (employees, branches, time, leave, payslips, warnings, documents, and photos)
- Backup restore: import a `.zip` (or older `.json`) backup and the workspace is rebuilt exactly as it was exported
- Browser persistence via localStorage and a lock-screen workflow

This version is a front-end workspace. A new installation starts completely empty — set up your own employees, branches, and custom fields, then use **Export → Full backup (.zip)** or **Settings → Your data** to download everything as a single ZIP archive, and **Import backup** to restore it later. Backups contain workspace data only — never the application code. Before using real employee data in production, connect it to an authenticated backend with encrypted file storage, role-based permissions, audit logs, and server-side backups.

## Build

```bash
npm run build
```
