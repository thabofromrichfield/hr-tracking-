import { CustomField, Employee, Group } from './types';

/**
 * A new workspace starts completely empty. Employee records, groups, and custom
 * fields are created by the HR team and stored in the browser.
 */
export const initialEmployees: Employee[] = [];
export const initialGroups: Group[] = [];
export const initialCustomFields: CustomField[] = [];

export const departments = ['Engineering', 'Design', 'People & Culture', 'Customer Success', 'Finance', 'Operations', 'Sales', 'Marketing'];
