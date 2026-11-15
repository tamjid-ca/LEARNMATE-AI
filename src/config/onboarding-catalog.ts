/**
 * LearnMate AI — Student Onboarding Curriculum Catalog
 * Shared constant catalog safe for both server services and client onboarding forms.
 */

export const ONBOARDING_CURRICULUM_CATALOG = {
  countries: [
    { code: 'BD', nameEn: 'Bangladesh', nameBn: 'বাংলাদেশ' },
    { code: 'INTL', nameEn: 'International / Global', nameBn: 'আন্তর্জাতিক' },
  ],
  educationSystems: [
    {
      code: 'BD-NCTB',
      country: 'BD',
      nameEn: 'Bangladesh National Curriculum (NCTB)',
      nameBn: 'জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (এনসিটিবি)',
    },
    {
      code: 'BD-COMPETITIVE',
      country: 'BD',
      nameEn: 'Bangladesh Competitive & Admission Exams',
      nameBn: 'বিশ্ববিদ্যালয় ভর্তি ও বিসিএস প্রস্তুতি',
    },
    {
      code: 'BD-UNIVERSITY',
      country: 'BD',
      nameEn: 'University Undergraduate Studies',
      nameBn: 'বিশ্ববিদ্যালয় স্নাতক পর্যায়',
    },
    {
      code: 'INTL-CAMBRIDGE',
      country: 'INTL',
      nameEn: 'Cambridge O/A Levels & International',
      nameBn: 'কেমব্রিজ ও/এ লেভেল এবং আন্তর্জাতিক',
    },
  ],
  educationLevels: [
    {
      code: 'SSC',
      systemCode: 'BD-NCTB',
      nameEn: 'SSC (Class 9–10)',
      nameBn: 'এসএসসি (নবম–দশম শ্রেণি)',
      defaultSubjects: [
        'Physics',
        'Chemistry',
        'Mathematics',
        'Higher Mathematics',
        'Biology',
        'English',
        'ICT',
      ],
    },
    {
      code: 'HSC',
      systemCode: 'BD-NCTB',
      nameEn: 'HSC (Class 11–12)',
      nameBn: 'এইচএসসি (একাদশ–দ্বাদশ শ্রেণি)',
      defaultSubjects: [
        'Physics 1st & 2nd Paper',
        'Chemistry 1st & 2nd Paper',
        'Higher Mathematics 1st & 2nd Paper',
        'Biology 1st & 2nd Paper',
        'ICT',
        'English',
      ],
    },
    {
      code: 'UNIV_ADMISSION',
      systemCode: 'BD-COMPETITIVE',
      nameEn: 'University Admission (Engineering / Medical / Varsity)',
      nameBn: 'বিশ্ববিদ্যালয় ভর্তি পরীক্ষা (ইঞ্জিনিয়ারিং / মেডিকেল / ভার্সিটি)',
      defaultSubjects: [
        'Physics',
        'Chemistry',
        'Mathematics',
        'Biology',
        'English',
        'General Knowledge',
      ],
    },
    {
      code: 'BCS',
      systemCode: 'BD-COMPETITIVE',
      nameEn: 'BCS & Government Job Preparation',
      nameBn: 'বিসিএস ও সরকারি চাকরি প্রস্তুতি',
      defaultSubjects: [
        'Bangladesh Affairs',
        'International Affairs',
        'Bangla Language & Literature',
        'English Language & Literature',
        'Mathematical Reasoning',
        'Mental Ability',
        'General Science & Computer',
      ],
    },
    {
      code: 'UNDERGRAD',
      systemCode: 'BD-UNIVERSITY',
      nameEn: 'University Undergraduate (CSE / EEE / BBA / Science)',
      nameBn: 'বিশ্ববিদ্যালয় স্নাতক',
      defaultSubjects: [
        'Data Structures & Algorithms',
        'Database Systems',
        'Linear Algebra',
        'Statistics',
        'Operating Systems',
      ],
    },
    {
      code: 'A_LEVEL',
      systemCode: 'INTL-CAMBRIDGE',
      nameEn: 'O / A Level & Independent Study',
      nameBn: 'ও / এ লেভেল ও স্বতন্ত্র অধ্যয়ন',
      defaultSubjects: [
        'Physics',
        'Chemistry',
        'Pure Mathematics',
        'Computer Science',
        'Economics',
      ],
    },
  ],
} as const;
