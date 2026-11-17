export type Status = 'Active' | 'On leave' | 'Resigned' | 'Terminated';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract';

export interface WorkEntry {
  id: string;
  title: string;
  project: string;
  description: string;
  startDate: string;
  endDate?: string;
  document?: string;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
  data?: string;
}

export interface Branch {
  id: string;
  name: string;
  description: string;
  lead: string;
  color: string;
}

export interface Employee {
  id: string;
  fullName: string;
  idNumber: string;
  employeeNumber: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  jobTitle: string;
  department: string;
  manager: string;
  employmentType: EmploymentType;
  startDate: string;
  status: Status;
  endDate?: string;
  photo?: string;
  bio: string;
  skills: string;
  languages: string;
  custom: Record<string, string>;
  branchId?: string;
  monthlySalary?: number;
  workHistory: WorkEntry[];
  documents: EmployeeDocument[];
  lastUpdated: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'Text' | 'Date' | 'Number';
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  notes?: string;
  approved: boolean;
  source: 'Manual' | 'Clock';
}

export type LeaveType = 'Annual' | 'Sick' | 'Family responsibility' | 'Unpaid' | 'Maternity';
export type LeaveStatus = 'Pending' | 'Approved' | 'Declined';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
}

export interface Payslip {
  id: string;
  employeeId: string;
  period: string;
  payDate: string;
  gross: number;
  overtime: number;
  allowances: number;
  deductions: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  includeUif: boolean;
  net: number;
  notes?: string;
  createdAt: string;
}

export type WarningCategory = 'Attendance & time' | 'Conduct' | 'Duty related' | 'Property' | 'Substances' | 'Custom';
export type WarningSeverity = 'Verbal' | 'Written' | 'Final';

export interface Warning {
  id: string;
  employeeId: string;
  category: WarningCategory;
  customCategory?: string;
  severity: WarningSeverity;
  issuedDate: string;
  details: string;
  issuedBy: string;
  acknowledged: boolean;
}
