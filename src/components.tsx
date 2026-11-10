import { ReactNode, useEffect } from 'react';
import { ChevronLeft, Download, Search, X } from 'lucide-react';
import { Employee, Status } from './types';

export const colors = ['#e5eee7', '#eee8df', '#e7e9f2', '#f2e5e2', '#e3eeee', '#ede8f3', '#e9eddf', '#f1e8df', '#e2eaf1', '#eee4e8'];
export const inkColors = ['#31634d', '#8a5e2d', '#505b8d', '#94594f', '#397278', '#6a5289', '#5e7135', '#91613b', '#426784', '#87546b'];

export function Avatar({ employee, size = 'md' }: { employee: Employee; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const index = Math.max(0, Number(employee.id.replace(/\D/g, '')) - 1) % colors.length;
  const initials = employee.fullName.split(' ').map(n => n[0]).slice(0, 2).join('');
  return <div className={`avatar avatar-${size}`} style={{ background: colors[index], color: inkColors[index] }}>
    {employee.photo ? <img src={employee.photo} alt={employee.fullName} /> : initials}
  </div>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status.toLowerCase().replace(' ', '-')}`}><i />{status}</span>;
}

export function Modal({ children, title, subtitle, onClose, wide = false }: { children: ReactNode; title: string; subtitle?: string; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <label className={`search-input ${className}`}><Search size={18} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />{value && <button onClick={() => onChange('')} aria-label="Clear search"><X size={15} /></button>}</label>;
}

export function PageBack({ onClick, children = 'Back' }: { onClick: () => void; children?: ReactNode }) {
  return <button className="back-link" onClick={onClick}><ChevronLeft size={17} />{children}</button>;
}

export function EmployeeTable({ employees, onOpen, showDepartment = true, compact = false }: { employees: Employee[]; onOpen: (id: string) => void; showDepartment?: boolean; compact?: boolean }) {
  return <div className="table-scroll"><table className="employee-table"><thead><tr><th>Employee</th>{!compact && <th>Employee no.</th>}{showDepartment && <th>Department</th>}{!compact && <th>Employment</th>}<th>Status</th>{!compact && <th>Start date</th>}<th /></tr></thead>
    <tbody>{employees.map(employee => <tr key={employee.id} onClick={() => onOpen(employee.id)}>
      <td><div className="person-cell"><Avatar employee={employee} /><div><strong>{employee.fullName}</strong><span>{employee.jobTitle}</span></div></div></td>
      {!compact && <td className="muted mono">{employee.employeeNumber}</td>}
      {showDepartment && <td>{employee.department}</td>}
      {!compact && <td>{employee.employmentType}</td>}<td><StatusBadge status={employee.status} /></td>
      {!compact && <td className="muted">{formatDate(employee.startDate)}</td>}<td><button className="row-open" aria-label={`Open ${employee.fullName}`}>→</button></td>
    </tr>)}</tbody></table>{employees.length === 0 && <div className="empty-table"><Search size={28} /><h3>No employees found</h3><p>Try changing your search or filters.</p></div>}</div>;
}

export function ExportMenu({ onCsv, onPrint, onClose }: { onCsv: () => void; onPrint: () => void; onClose: () => void }) {
  return <div className="export-menu"><button onClick={() => { onCsv(); onClose(); }}><Download size={16} /><span>Export spreadsheet<small>CSV file, opens in Excel</small></span></button><button onClick={() => { onPrint(); onClose(); }}><Download size={16} /><span>Export PDF<small>Print or save current view</small></span></button></div>;
}

export function formatDate(date?: string, long = false) {
  if (!date) return '—';
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-ZA', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' });
}

export function yearsAtCompany(startDate: string, endDate?: string) {
  const years = (new Date(endDate || Date.now()).getTime() - new Date(startDate).getTime()) / 31557600000;
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${years.toFixed(1)} years`;
}
