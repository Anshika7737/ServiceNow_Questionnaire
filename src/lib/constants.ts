export const EXAM_TYPES = [
  {
    value: "CSA",
    label: "CIS - CSA",
    description: "Certified System Administrator",
  },
  {
    value: "CAD",
    label: "CIS - CAD",
    description: "Certified Application Developer",
  },
  {
    value: "ITSM",
    label: "CIS - ITSM",
    description: "IT Service Management",
  },
  {
    value: "CSM",
    label: "CIS - CSM",
    description: "Customer Service Management",
  },
  {
    value: "DATA_FOUNDATION",
    label: "CIS - Data Foundation",
    description: "Data Foundation Certification",
  },
] as const;

export type ExamTypeValue = (typeof EXAM_TYPES)[number]["value"];

export const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
} as const;
