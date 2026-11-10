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
  groups: string[];
  workHistory: WorkEntry[];
  documents: EmployeeDocument[];
  lastUpdated: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  lead: string;
  parentId?: string;
  color: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'Text' | 'Date' | 'Number';
}
