export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface UserDoc {
  uid: string;
  email: string;
  role: 'candidate' | 'employer' | 'admin';
  createdAt: any;
}

export interface CandidateDoc {
  uid: string;
  kubasaId: string;
  fullName: string;
  email: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  education?: Array<{ institution: string; degree: string; year: string }>;
  workExperience?: Array<{ company: string; role: string; startYear: string; endYear?: string; description?: string }>;
  cvUrl?: string;
  cvPath?: string;
  isLookingForWork: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface EmployerDoc {
  uid: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  industry?: string;
  website?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  shortlist?: string[];
  createdAt: any;
}

export interface JobDoc {
  id: string;
  employerUid: string;
  companyName: string;
  title: string;
  description: string;
  location: string;
  salaryRange?: string;
  requirements?: string[];
  createdAt: any;
}
