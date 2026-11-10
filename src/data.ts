import { CustomField, Employee, Group } from './types';

const history = (id: string, title: string, project: string, startDate: string, description: string, endDate?: string) => ({
  id, title, project, startDate, endDate, description,
  document: `${title.replaceAll(' ', '_')}_scope.pdf`,
});

export const initialEmployees: Employee[] = [
  {
    id: 'e1', fullName: 'Naledi Mokoena', idNumber: '9205145800087', employeeNumber: 'PF-0018', dob: '1992-05-14',
    phone: '+27 82 555 0142', email: 'naledi.mokoena@peopleflow.co.za', address: '18 Linden Street, Randburg, Johannesburg',
    emergencyName: 'Thabo Mokoena', emergencyPhone: '+27 82 555 0198', jobTitle: 'Senior Product Designer', department: 'Design',
    manager: 'Daniel Jacobs', employmentType: 'Full-time', startDate: '2024-02-12', status: 'Active',
    bio: 'Thoughtful product designer who loves turning complex problems into simple, human experiences. Outside work, Naledi is an avid trail runner and ceramicist.',
    skills: 'Product strategy, Figma, Design systems, User research', languages: 'English, Sesotho, isiZulu',
    custom: { 'T-shirt size': 'M', "Driver's licence code": 'B' }, groups: ['g1', 'g3'], lastUpdated: '2026-11-08T10:30:00',
    workHistory: [
      history('w1', 'Senior Product Designer', 'Customer experience', '2026-01-01', 'Leads end-to-end product design for the customer workspace and mentors two designers.'),
      history('w2', 'Product Designer', 'Mobile redesign', '2024-02-12', 'Redesigned core mobile journeys and established the first component library.', '2025-12-31'),
    ],
    documents: [
      { id: 'd1', name: 'Employment_contract.pdf', type: 'Contract', date: '2024-02-12', size: '1.2 MB' },
      { id: 'd2', name: 'Senior_designer_scope.pdf', type: 'Scope of work', date: '2026-01-04', size: '486 KB' },
    ],
  },
  {
    id: 'e2', fullName: 'Liam van der Merwe', idNumber: '8809125046083', employeeNumber: 'PF-0021', dob: '1988-09-12',
    phone: '+27 71 555 0164', email: 'liam.vdm@peopleflow.co.za', address: '42 Chester Road, Parkwood, Johannesburg',
    emergencyName: 'Mia van der Merwe', emergencyPhone: '+27 71 555 0165', jobTitle: 'Engineering Lead', department: 'Engineering',
    manager: 'Ayesha Patel', employmentType: 'Full-time', startDate: '2023-08-01', status: 'Active',
    bio: 'Engineering lead focused on reliable platforms, healthy teams, and pragmatic technical decisions.',
    skills: 'TypeScript, Cloud architecture, Technical leadership', languages: 'English, Afrikaans',
    custom: { 'T-shirt size': 'L', "Driver's licence code": 'EB' }, groups: ['g1', 'g2'], lastUpdated: '2026-11-06T14:20:00',
    workHistory: [history('w3', 'Engineering Lead', 'Platform team', '2025-03-01', 'Owns technical direction and delivery for the platform engineering team.')],
    documents: [{ id: 'd3', name: 'Liam_contract.pdf', type: 'Contract', date: '2023-08-01', size: '940 KB' }],
  },
  {
    id: 'e3', fullName: 'Ayesha Patel', idNumber: '9003280215081', employeeNumber: 'PF-0009', dob: '1990-03-28',
    phone: '+27 83 555 0117', email: 'ayesha.patel@peopleflow.co.za', address: '9 4th Avenue, Melville, Johannesburg',
    emergencyName: 'Zaid Patel', emergencyPhone: '+27 83 555 0101', jobTitle: 'Head of People', department: 'People & Culture',
    manager: 'Sarah Ndlovu', employmentType: 'Full-time', startDate: '2022-05-09', status: 'Active',
    bio: 'People partner, coach, and builder of inclusive teams. Ayesha leads our people operations and culture initiatives.',
    skills: 'People strategy, Coaching, Organisational design', languages: 'English, Hindi',
    custom: { 'T-shirt size': 'S', "Driver's licence code": 'B' }, groups: ['g1'], lastUpdated: '2026-11-09T09:15:00',
    workHistory: [history('w4', 'Head of People', 'People & Culture', '2024-01-01', 'Leads people operations, talent development, and workplace culture.')],
    documents: [{ id: 'd4', name: 'Ayesha_ID_copy.pdf', type: 'Identification', date: '2022-05-09', size: '620 KB' }],
  },
  {
    id: 'e4', fullName: 'Sipho Dlamini', idNumber: '9507175432088', employeeNumber: 'PF-0034', dob: '1995-07-17',
    phone: '+27 72 555 0188', email: 'sipho.dlamini@peopleflow.co.za', address: '77 Vilakazi Street, Soweto, Johannesburg',
    emergencyName: 'Nomsa Dlamini', emergencyPhone: '+27 72 555 0123', jobTitle: 'Customer Success Manager', department: 'Customer Success',
    manager: 'Chloe Adams', employmentType: 'Full-time', startDate: '2025-10-20', status: 'On leave',
    bio: 'Customer success manager with a talent for building lasting client relationships and solving problems calmly.',
    skills: 'Account management, Onboarding, Salesforce', languages: 'English, isiZulu, isiXhosa',
    custom: { 'T-shirt size': 'L', "Driver's licence code": 'B' }, groups: ['g4'], lastUpdated: '2026-11-03T16:40:00',
    workHistory: [history('w5', 'Customer Success Manager', 'Enterprise accounts', '2025-10-20', 'Manages onboarding and ongoing success for a portfolio of enterprise customers.')],
    documents: [{ id: 'd5', name: 'Signed_scope_of_work.pdf', type: 'Scope of work', date: '2025-10-20', size: '728 KB' }],
  },
  {
    id: 'e5', fullName: 'Chloe Adams', idNumber: '9302010098086', employeeNumber: 'PF-0015', dob: '1993-02-01',
    phone: '+27 79 555 0132', email: 'chloe.adams@peopleflow.co.za', address: '25 Tyrone Avenue, Parkview, Johannesburg',
    emergencyName: 'James Adams', emergencyPhone: '+27 79 555 0177', jobTitle: 'Customer Success Director', department: 'Customer Success',
    manager: 'Sarah Ndlovu', employmentType: 'Full-time', startDate: '2023-11-06', status: 'Active',
    bio: 'Customer advocate and commercial leader who enjoys helping teams do their best work.',
    skills: 'Customer strategy, Team leadership, Negotiation', languages: 'English',
    custom: { 'T-shirt size': 'M', "Driver's licence code": 'B' }, groups: ['g1', 'g4'], lastUpdated: '2026-10-28T11:00:00',
    workHistory: [history('w6', 'Customer Success Director', 'Customer organisation', '2025-06-01', 'Leads customer success strategy and the growing customer team.')],
    documents: [],
  },
  {
    id: 'e6', fullName: 'Daniel Jacobs', idNumber: '8511255167080', employeeNumber: 'PF-0006', dob: '1985-11-25',
    phone: '+27 82 555 0181', email: 'daniel.jacobs@peopleflow.co.za', address: '6 Jan Smuts Avenue, Rosebank, Johannesburg',
    emergencyName: 'Leah Jacobs', emergencyPhone: '+27 82 555 0112', jobTitle: 'Design Director', department: 'Design',
    manager: 'Sarah Ndlovu', employmentType: 'Full-time', startDate: '2021-09-13', status: 'Active',
    bio: 'Design director with a background in brand and digital products. Passionate about craft and mentoring.',
    skills: 'Creative direction, Design leadership, Brand systems', languages: 'English, Afrikaans',
    custom: { 'T-shirt size': 'XL', "Driver's licence code": 'B' }, groups: ['g1', 'g3'], lastUpdated: '2026-10-25T08:45:00',
    workHistory: [history('w7', 'Design Director', 'Design studio', '2024-04-01', 'Directs design quality, team growth, and cross-functional creative strategy.')],
    documents: [],
  },
  {
    id: 'e7', fullName: 'Zanele Khumalo', idNumber: '9810060321084', employeeNumber: 'PF-0042', dob: '1998-10-06',
    phone: '+27 76 555 0190', email: 'zanele.khumalo@peopleflow.co.za', address: '13 Barry Hertzog Avenue, Greenside, Johannesburg',
    emergencyName: 'Sbusiso Khumalo', emergencyPhone: '+27 76 555 0119', jobTitle: 'People Operations Coordinator', department: 'People & Culture',
    manager: 'Ayesha Patel', employmentType: 'Full-time', startDate: '2026-10-05', status: 'Active',
    bio: 'Organised people operations coordinator who cares about creating a warm, seamless employee experience.',
    skills: 'HR administration, Employee onboarding, Coordination', languages: 'English, isiZulu',
    custom: { 'T-shirt size': 'S', "Driver's licence code": 'Learners' }, groups: ['g4'], lastUpdated: '2026-11-07T15:10:00',
    workHistory: [history('w8', 'People Operations Coordinator', 'People operations', '2026-10-05', 'Coordinates onboarding, employee records, and people team initiatives.')],
    documents: [{ id: 'd7', name: 'Qualifications.pdf', type: 'Qualification', date: '2026-10-05', size: '1.1 MB' }],
  },
  {
    id: 'e8', fullName: 'Ethan Botha', idNumber: '9702195077089', employeeNumber: 'PF-0040', dob: '1997-02-19',
    phone: '+27 73 555 0146', email: 'ethan.botha@peopleflow.co.za', address: '31 Greenway, Blairgowrie, Johannesburg',
    emergencyName: 'Pieter Botha', emergencyPhone: '+27 73 555 0128', jobTitle: 'Software Engineer', department: 'Engineering',
    manager: 'Liam van der Merwe', employmentType: 'Full-time', startDate: '2026-08-17', status: 'Active',
    bio: 'Curious software engineer with an interest in delightful interfaces and dependable systems.',
    skills: 'React, Node.js, PostgreSQL', languages: 'English, Afrikaans',
    custom: { 'T-shirt size': 'M', "Driver's licence code": 'B' }, groups: ['g2'], lastUpdated: '2026-11-01T13:25:00',
    workHistory: [history('w9', 'Software Engineer', 'Web applications', '2026-08-17', 'Builds and maintains customer-facing web applications and internal tools.')],
    documents: [],
  },
  {
    id: 'e9', fullName: 'Maya Naidoo', idNumber: '9604220064085', employeeNumber: 'PF-0037', dob: '1996-04-22',
    phone: '+27 81 555 0133', email: 'maya.naidoo@peopleflow.co.za', address: '8 Central Avenue, Orange Grove, Johannesburg',
    emergencyName: 'Ravi Naidoo', emergencyPhone: '+27 81 555 0155', jobTitle: 'Finance Administrator', department: 'Finance',
    manager: 'Sarah Ndlovu', employmentType: 'Part-time', startDate: '2026-01-12', status: 'On leave',
    bio: 'Detail-oriented finance administrator supporting payroll, invoicing, and reporting.',
    skills: 'Payroll, Xero, Financial reporting', languages: 'English, Tamil',
    custom: { 'T-shirt size': 'S', "Driver's licence code": 'B' }, groups: [], lastUpdated: '2026-10-30T12:00:00',
    workHistory: [history('w10', 'Finance Administrator', 'Finance operations', '2026-01-12', 'Supports payroll, reconciliations, invoicing, and monthly finance reporting.')],
    documents: [],
  },
  {
    id: 'e10', fullName: 'Kagiso Molefe', idNumber: '9108105678082', employeeNumber: 'PF-0028', dob: '1991-08-10',
    phone: '+27 74 555 0171', email: 'kagiso.molefe@peopleflow.co.za', address: '55 Queens Road, Parkhurst, Johannesburg',
    emergencyName: 'Lerato Molefe', emergencyPhone: '+27 74 555 0182', jobTitle: 'QA Analyst', department: 'Engineering',
    manager: 'Liam van der Merwe', employmentType: 'Contract', startDate: '2025-06-02', status: 'Resigned', endDate: '2026-10-30',
    bio: 'Quality analyst with a methodical approach and excellent eye for detail.',
    skills: 'Quality assurance, Test automation, Playwright', languages: 'English, Setswana',
    custom: { 'T-shirt size': 'L', "Driver's licence code": 'B' }, groups: ['g2'], lastUpdated: '2026-10-30T17:00:00',
    workHistory: [history('w11', 'QA Analyst', 'Product quality', '2025-06-02', 'Owned release testing and introduced automated browser regression tests.', '2026-10-30')],
    documents: [{ id: 'd10', name: 'Resignation_acceptance.pdf', type: 'Offboarding', date: '2026-10-16', size: '240 KB' }],
  },
];

export const initialGroups: Group[] = [
  { id: 'g1', name: 'Leadership team', description: 'Department heads and company leadership', lead: 'Sarah Ndlovu', color: '#6d5bd0' },
  { id: 'g2', name: 'Product engineering', description: 'Engineers building our core product', lead: 'Liam van der Merwe', parentId: 'g1', color: '#347c70' },
  { id: 'g3', name: 'Design studio', description: 'Product design and creative team', lead: 'Daniel Jacobs', parentId: 'g1', color: '#d17a56' },
  { id: 'g4', name: 'Customer experience', description: 'People supporting customers and internal teams', lead: 'Chloe Adams', color: '#5278bd' },
];

export const initialCustomFields: CustomField[] = [
  { id: 'cf1', label: 'T-shirt size', type: 'Text' },
  { id: 'cf2', label: "Driver's licence code", type: 'Text' },
];

export const departments = ['Engineering', 'Design', 'People & Culture', 'Customer Success', 'Finance', 'Operations', 'Sales', 'Marketing'];
