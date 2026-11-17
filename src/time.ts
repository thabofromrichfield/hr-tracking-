import { Employee, LeaveRequest, TimeEntry } from './types';

export const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const localTime = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const minutesOf = (time?: string) => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

export const workedHours = (entry: Pick<TimeEntry, 'clockIn' | 'clockOut' | 'breakMinutes'>) => {
  const start = minutesOf(entry.clockIn);
  const end = minutesOf(entry.clockOut);
  if (start === null || end === null || end <= start) return 0;
  const breakMinutes = Math.max(0, entry.breakMinutes || 0);
  return Math.max(0, (end - start - breakMinutes) / 60);
};

export const totalHours = (entries: TimeEntry[]) => entries.reduce((total, entry) => total + workedHours(entry), 0);

export const formatHours = (hours: number) => `${hours.toFixed(hours % 1 === 0 ? 0 : 2)} h`;

export const addDays = (dateISO: string, days: number) => {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
};

/** Monday-based start of the week containing the given date. */
export const startOfWeek = (dateISO: string) => {
  const date = new Date(`${dateISO}T12:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - offset);
  return localDate(date);
};

export const weekDates = (weekStartISO: string) => Array.from({ length: 7 }, (_, index) => addDays(weekStartISO, index));

export const weekLabel = (weekStartISO: string) => {
  const start = new Date(`${weekStartISO}T12:00:00`);
  const end = new Date(`${addDays(weekStartISO, 6)}T12:00:00`);
  const month = (date: Date) => date.toLocaleDateString('en-ZA', { month: 'short' });
  return `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
};

export const shortDay = (dateISO: string) => new Date(`${dateISO}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' });

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};

export const weekdayCount = (startISO: string, endISO: string) => {
  if (!startISO || !endISO || endISO < startISO) return 0;
  let cursor = startISO;
  let days = 0;
  let guard = 0;
  while (cursor <= endISO && guard < 400) {
    const day = new Date(`${cursor}T12:00:00`).getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
};

export const coversDate = (startISO: string, endISO: string, dateISO: string) => startISO <= dateISO && dateISO <= endISO;

export const zar = (amount: number) => `R ${Number(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** UIF: 1% employee and 1% employer, each capped at the monthly ceiling. */
export const UIF_RATE = 0.01;
export const UIF_MONTHLY_CAP = 177.12;
export const uifContribution = (gross: number) => Math.min(Math.round(gross * UIF_RATE * 100) / 100, UIF_MONTHLY_CAP);

export const toCsv = (headers: string[], rows: unknown[][]) =>
  '\ufeff' + [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');

export const downloadFile = (blob: Blob, name: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
};

export const hoursBetweenDates = (fromISO: string, toISO: string) => {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return (to - from) / 3600000;
};

export const summarizeLeave = (requests: LeaveRequest[], employees: Employee[], today: string) => {
  const year = today.slice(0, 4);
  const approved = requests.filter(request => request.status === 'Approved');
  return {
    pending: requests.filter(request => request.status === 'Pending').length,
    approved: approved.length,
    onLeaveToday: employees.filter(employee => approved.some(request => request.employeeId === employee.id && coversDate(request.startDate, request.endDate, today))).length,
    daysThisYear: approved.filter(request => request.startDate.startsWith(year)).reduce((total, request) => total + request.days, 0),
  };
};
