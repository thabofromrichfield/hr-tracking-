import type { Branch, CustomField, Employee } from './types.ts';

/**
 * A new workspace starts with no employees. The three operating branches are
 * pre-created so people and time can be recorded against them straight away.
 */
export const initialEmployees: Employee[] = [];
export const initialCustomFields: CustomField[] = [];

export const initialBranches: Branch[] = [
  { id: 'br-ekurhuleni', name: 'Ekurhuleni', description: 'East Rand operations, depots, and field crews', lead: '', color: '#5B6CF9' },
  { id: 'br-joburg', name: 'Joburg', description: 'Johannesburg head office and city teams', lead: '', color: '#06B6D4' },
  { id: 'br-tshwane', name: 'Tshwane', description: 'Pretoria office and surrounds', lead: '', color: '#F59E0B' },
];

export const departments = ['Engineering', 'Design', 'People & Culture', 'Customer Success', 'Finance', 'Operations', 'Sales', 'Marketing'];

export const leaveTypes = ['Annual', 'Sick', 'Family responsibility', 'Unpaid', 'Maternity'] as const;

export const warningCategories = ['Attendance & time', 'Conduct', 'Duty related', 'Property', 'Substances', 'Custom'] as const;

export const warningSeverities = ['Verbal', 'Written', 'Final'] as const;
