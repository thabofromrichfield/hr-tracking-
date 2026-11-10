import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Download, MoreHorizontal, Plus } from 'lucide-react';
import { Avatar, StatusBadge, formatDate } from './components';
import { Employee } from './types';

export default function Overview({ employees, onOpen, onDirectory, onAdd, onExport }: { employees: Employee[]; onOpen: (id: string) => void; onDirectory: (filter?: string) => void; onAdd: () => void; onExport: () => void }) {
  const current = employees.filter(e => e.status === 'Active' || e.status === 'On leave');
  const active = employees.filter(e => e.status === 'Active');
  const onLeave = employees.filter(e => e.status === 'On leave');
  const former = employees.length - current.length;
  const deptCounts = Object.entries(current.reduce<Record<string, number>>((acc, e) => { acc[e.department] = (acc[e.department] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const recent = [...current].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5);
  const newestThisYear = current.filter(e => e.startDate >= '2026-01-01').length;
  const percentage = (count: number) => Math.round(count / Math.max(1, current.length) * 100);
  const fullTime = current.filter(e => e.employmentType === 'Full-time').length;
  const partTime = current.filter(e => e.employmentType === 'Part-time').length;
  const contract = current.filter(e => e.employmentType === 'Contract').length;
  const maxDept = Math.max(...deptCounts.map(d => d[1]), 1);
  const employmentData = [
    { label: 'Full-time', count: fullTime, color: '#5B6CF9' },
    { label: 'Part-time', count: partTime, color: '#06B6D4' },
    { label: 'Contract', count: contract, color: '#F59E0B' },
  ];
  const [selectedType, setSelectedType] = useState('Full-time');
  const selectedEmployment = employmentData.find(item => item.label === selectedType) || employmentData[0];
  return <div className="goodfood-overview">
    <div className="gf-page-heading"><div><h1>Dashboard</h1><p>Welcome back! Here is your people overview.</p></div></div>
    <div className="gf-metrics-grid">
      <section className="gf-card gf-summary-card"><div className="gf-summary-top"><div><span className="gf-kicker">TOTAL EMPLOYEES</span><h2>{current.length}</h2><div className="gf-change positive"><ArrowUpRight size={13} /><strong>{newestThisYear} new</strong><span>this year</span></div></div><button className="gf-report-btn" onClick={() => onDirectory()}>View directory</button></div><p className="gf-period">Employee records from January – November 2026</p><div className="gf-target"><div><span>Active workforce ({Math.round(active.length / Math.max(1, current.length) * 100)}%)</span><strong>{active.length} of {current.length} current</strong></div><div className="gf-progress"><i style={{ width: `${active.length / Math.max(1, current.length) * 100}%` }} /></div></div></section>
      <section className="gf-card gf-summary-card"><div className="gf-summary-top"><div><span className="gf-kicker">WORKFORCE STATUS</span><h2>{employees.length} <small>records</small></h2><div className={`gf-change ${onLeave.length ? 'away' : 'positive'}`}>{onLeave.length ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}<strong>{onLeave.length} on leave</strong><span>today</span></div></div><button className="gf-report-btn" onClick={() => onDirectory('All statuses')}>View report</button></div><p className="gf-period">A live view of your current and former employees</p><div className="gf-status-pills"><button className="active-pill" onClick={() => onDirectory('Active')}><span>ACTIVE</span><strong>{percentage(active.length)}% ({active.length})</strong></button><button className="leave-pill" onClick={() => onDirectory('On leave')}><span>ON LEAVE</span><strong>{onLeave.length} people</strong></button><button className="former-pill" onClick={() => onDirectory('All statuses')}><span>FORMER</span><strong>{former} records</strong></button></div></section>
    </div>
    <div className="gf-bottom-grid">
      <section className="gf-card composition-card"><div className="gf-card-title"><div><h2>Your workforce</h2><p>Employment types across your current team.</p></div><button><MoreHorizontal size={18} /></button></div><div className="employment-chart"><div className="employment-chart-grid"><i /><i /><i /><i /></div>{employmentData.map(item => <button key={item.label} className={`employment-bar ${selectedType === item.label ? 'selected' : ''}`} onClick={() => setSelectedType(item.label)} aria-pressed={selectedType === item.label} title={`${item.label}: ${item.count} employees`}><span className="employment-tooltip">{item.count} employees · {percentage(item.count)}%</span><div className="employment-bar-area"><div className="employment-bar-value" style={{ height: `${Math.max(item.count ? 12 : 2, percentage(item.count))}%`, background: item.color }}><span>{percentage(item.count)}%</span></div></div><strong>{item.label}</strong><small>{item.count} {item.count === 1 ? 'person' : 'people'}</small></button>)}</div><div className="employment-selection"><div><i style={{ background: selectedEmployment.color }} /><span>Selected employment type</span></div><strong>{selectedEmployment.label}</strong><p>{selectedEmployment.count} of {current.length} current employees · {percentage(selectedEmployment.count)}% of your workforce</p><button onClick={() => onDirectory()}>View employees<ArrowRight size={12} /></button></div></section>
      <section className="gf-card recent-employees-card"><div className="gf-card-title"><div><h2>Newest employees</h2><p>The latest additions to your growing team.</p></div><button className="gf-view-all" onClick={() => onDirectory()}>View all</button></div><div className="gf-employee-list">{recent.map(e => <button key={e.id} onClick={() => onOpen(e.id)}><Avatar employee={e} /><div><strong>{e.fullName}</strong><span>{e.jobTitle}</span></div><div className="gf-employee-date"><strong>{formatDate(e.startDate)}</strong><span>{e.department}</span></div><ChevronRight size={14} /></button>)}</div></section>
    </div>
    <section className="gf-card gf-departments"><div className="gf-card-title"><div><h2>People by department</h2><p>Current employee distribution across the company.</p></div><button className="gf-view-all" onClick={() => onDirectory()}>View directory<ArrowRight size={12} /></button></div><div className="gf-department-grid">{deptCounts.map(([dept, count], i) => <button key={dept} onClick={() => onDirectory()}><div><span>{dept}</span><strong>{count}</strong></div><div className="gf-dept-track"><i className={`dept-color-${i}`} style={{ width: `${Math.max(12, count / maxDept * 100)}%` }} /></div></button>)}</div></section>
    <div className="gf-leave-note"><CalendarDays size={15} /><span>{onLeave.length ? `${onLeave.map(e => e.fullName.split(' ')[0]).join(' and ')} currently away · Expected back 16 November` : 'Everyone is in today'}</span><button onClick={() => onDirectory('On leave')}>View leave<ArrowRight size={12} /></button></div>
  </div>;
}
