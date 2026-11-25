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
- Supabase Auth (`peopleflow`) gate supporting Email & Password, Email OTP, and Number OTP for existing directory users only (`shouldCreateUser: false`)
- Ephemeral in-memory authentication (`persistSession: false`): zero session cookies or persisted auth tokens, so reloading the page always requires signing in again

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=https://qnoxvzhsywmyatiqdedj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
```

## Build

```bash
npm run build
```
