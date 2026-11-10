import { FormEvent, useRef, useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { departments } from './data';
import { CustomField, Employee, EmploymentType, Status } from './types';
import { Avatar, Modal } from './components';

const blank: Omit<Employee, 'id' | 'lastUpdated' | 'workHistory' | 'documents' | 'groups'> = {
  fullName: '', idNumber: '', employeeNumber: '', dob: '', phone: '', email: '', address: '', emergencyName: '', emergencyPhone: '',
  jobTitle: '', department: 'Engineering', manager: '', employmentType: 'Full-time', startDate: new Date().toISOString().slice(0, 10),
  status: 'Active', bio: '', skills: '', languages: '', custom: {},
};

export default function EmployeeForm({ employee, customFields, onClose, onSave }: {
  employee?: Employee; customFields: CustomField[]; onClose: () => void;
  onSave: (data: Omit<Employee, 'id' | 'lastUpdated' | 'workHistory' | 'documents' | 'groups'>) => void;
}) {
  const [form, setForm] = useState(employee ? { ...employee, custom: { ...employee.custom } } : blank);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const submit = (e: FormEvent) => { e.preventDefault(); onSave(form); };
  const photo = (file?: File) => {
    if (!file) return;
    if (file.size > 1500000) return alert('Please choose a photo smaller than 1.5 MB.');
    const reader = new FileReader(); reader.onload = () => set('photo', String(reader.result)); reader.readAsDataURL(file);
  };

  return <Modal title={employee ? 'Edit employee' : 'Register a new employee'} subtitle={employee ? `Update ${employee.fullName}'s information` : 'Add their details to create an employee profile'} onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="modal-body employee-form">
        <div className="photo-form"><Avatar employee={{ ...form, id: employee?.id || 'e0' } as Employee} size="lg" /><div><button type="button" className="btn btn-secondary btn-small" onClick={() => fileRef.current?.click()}><Camera size={15} />{form.photo ? 'Change photo' : 'Add photo'}</button><span>Optional · JPG or PNG</span></div><input ref={fileRef} type="file" accept="image/*" hidden onChange={e => photo(e.target.files?.[0])} /></div>
        <FormSection title="Personal information" number="01">
          <Field label="Full name" required><input required value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="e.g. Thandi Moyo" /></Field>
          <Field label="Employee number" required><input required value={form.employeeNumber} onChange={e => set('employeeNumber', e.target.value)} placeholder="PF-0000" /></Field>
          <Field label="ID number" required><input required value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="South African ID number" /></Field>
          <Field label="Date of birth" required><input required type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></Field>
          <Field label="Email address" required><input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@company.co.za" /></Field>
          <Field label="Contact number" required><input required value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+27" /></Field>
          <Field label="Home address" full><input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, suburb, city" /></Field>
          <Field label="Emergency contact"><input value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} placeholder="Contact name" /></Field>
          <Field label="Emergency number"><input value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} placeholder="+27" /></Field>
        </FormSection>
        <FormSection title="Employment details" number="02">
          <Field label="Job title" required><input required value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="e.g. Product Designer" /></Field>
          <Field label="Department" required><select value={form.department} onChange={e => set('department', e.target.value)}>{departments.map(d => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Reports to"><input value={form.manager} onChange={e => set('manager', e.target.value)} placeholder="Manager's full name" /></Field>
          <Field label="Employment type"><select value={form.employmentType} onChange={e => set('employmentType', e.target.value as EmploymentType)}><option>Full-time</option><option>Part-time</option><option>Contract</option></select></Field>
          <Field label="Start date" required><input required type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
          <Field label="Status"><select value={form.status} onChange={e => set('status', e.target.value as Status)}><option>Active</option><option>On leave</option><option>Resigned</option><option>Terminated</option></select></Field>
          {(form.status === 'Resigned' || form.status === 'Terminated') && <Field label="End date" required><input required type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} /></Field>}
        </FormSection>
        <FormSection title="A little more about them" number="03">
          <Field label="Short bio" full><textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="A few words about who they are, their interests, or what they care about..." rows={3} /></Field>
          <Field label="Skills"><input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="Separated by commas" /></Field>
          <Field label="Languages"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="Separated by commas" /></Field>
          {customFields.map(field => <Field key={field.id} label={field.label}><input type={field.type === 'Text' ? 'text' : field.type.toLowerCase()} value={form.custom[field.label] || ''} onChange={e => setForm(f => ({ ...f, custom: { ...f.custom, [field.label]: e.target.value } }))} /></Field>)}
        </FormSection>
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Save size={17} />{employee ? 'Save changes' : 'Register employee'}</button></div>
    </form>
  </Modal>;
}

function FormSection({ title, number, children }: { title: string; number: string; children: React.ReactNode }) {
  return <section className="form-section"><h3><span>{number}</span>{title}</h3><div className="form-grid">{children}</div></section>;
}
function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return <label className={`field ${full ? 'field-full' : ''}`}><span>{label}{required && <em>*</em>}</span>{children}</label>;
}
