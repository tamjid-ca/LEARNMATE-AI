/**
 * LearnMate AI — Authoritative Bangladesh & International Curriculum Seed Dataset
 * Grounded in docs/PROJECT_SRS.md Section 2.4 & Section 4.3:
 * Education System → Education Level → Examination → Subject → Chapter → Topic
 */

import type { DifficultyLevel, SupportedLanguage } from '../../types/domain.ts';

export interface EducationSystemRecord {
  id: string;
  code: string;
  name: string;
  country: string;
  description?: string;
  supportedLanguages: SupportedLanguage[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EducationLevelRecord {
  id: string;
  educationSystemId: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExaminationRecord {
  id: string;
  educationSystemId: string;
  educationLevelId: string;
  code: string;
  name: string;
  description?: string;
  examDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectRecord {
  id: string;
  educationSystemId: string;
  educationLevelId: string;
  examinationIds: string[];
  code: string;
  name: string;
  nameBn?: string;
  description?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterRecord {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  titleBn?: string;
  description?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicRecord {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  description?: string;
  learningObjectives: string[];
  prerequisiteTopicIds: string[];
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  keyConcepts: string[];
  curriculumReferences: string[];
  syllabusWeightVerified: boolean;
  syllabusPriorityScore?: number;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorRole: 'student' | 'content_manager' | 'admin';
  action: string;
  targetCollection?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const SEED_DATE = new Date('2026-01-15T00:00:00.000Z');

export const SEED_IDS = {
  systems: {
    bdNctb: '66f000000000000000000101',
    bdComp: '66f000000000000000000102',
    intlCamb: '66f000000000000000000103',
  },
  levels: {
    ssc: '66f000000000000000000201',
    hsc: '66f000000000000000000202',
    univAdmission: '66f000000000000000000203',
    bcs: '66f000000000000000000204',
    aLevel: '66f000000000000000000205',
  },
  examinations: {
    hsc2027: '66f000000000000000000301',
    ssc2027: '66f000000000000000000302',
    buetAdm2027: '66f000000000000000000303',
    bcs47: '66f000000000000000000304',
  },
  subjects: {
    hscPhysics: '66f000000000000000000401',
    hscChemistry: '66f000000000000000000402',
    hscHigherMath: '66f000000000000000000403',
    hscIct: '66f000000000000000000404',
    sscPhysics: '66f000000000000000000405',
    bcsBangladeshAffairs: '66f000000000000000000406',
  },
  chapters: {
    hscPhysMechanics: '66f000000000000000000501',
    hscPhysThermo: '66f000000000000000000502',
    hscChemOrganic: '66f000000000000000000503',
    hscMathCalculus: '66f000000000000000000504',
    hscIctDigitalLogic: '66f000000000000000000505',
    bcsBdHistory: '66f000000000000000000506',
  },
  topics: {
    newtonsLaws: '66f000000000000000000601',
    conservationOfMomentum: '66f000000000000000000602',
    workEnergyPower: '66f000000000000000000603',
    lawsOfThermodynamics: '66f000000000000000000604',
    hydrocarbonsReactions: '66f000000000000000000605',
    limitsAndDerivatives: '66f000000000000000000606',
    definiteIntegration: '66f000000000000000000607',
    booleanAlgebraGates: '66f000000000000000000608',
    liberationWar1971: '66f000000000000000000609',
  },
} as const;

export const INITIAL_EDUCATION_SYSTEMS: EducationSystemRecord[] = [
  {
    id: SEED_IDS.systems.bdNctb,
    code: 'BD-NCTB',
    name: 'Bangladesh National Curriculum (NCTB)',
    country: 'BD',
    description:
      'National Curriculum and Textbook Board (NCTB) syllabus for SSC and HSC secondary/higher-secondary education in Bangladesh.',
    supportedLanguages: ['en', 'bn'],
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.systems.bdComp,
    code: 'BD-COMPETITIVE',
    name: 'Bangladesh Competitive & Admission Examinations',
    country: 'BD',
    description:
      'Engineering, Medical, Public University Admission, and BCS Civil Service competitive examination syllabi.',
    supportedLanguages: ['en', 'bn'],
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.systems.intlCamb,
    code: 'INTL-CAMBRIDGE',
    name: 'Cambridge International O & A Levels',
    country: 'INTL',
    description: 'Cambridge International GCSE, AS, and A Level academic syllabi.',
    supportedLanguages: ['en'],
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const INITIAL_EDUCATION_LEVELS: EducationLevelRecord[] = [
  {
    id: SEED_IDS.levels.ssc,
    educationSystemId: SEED_IDS.systems.bdNctb,
    code: 'SSC',
    name: 'SSC (Class 9–10)',
    description: 'Secondary School Certificate (Class 9 and Class 10 national board curriculum).',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.levels.hsc,
    educationSystemId: SEED_IDS.systems.bdNctb,
    code: 'HSC',
    name: 'HSC (Class 11–12)',
    description: 'Higher Secondary Certificate (Class 11 and Class 12 national board curriculum).',
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.levels.univAdmission,
    educationSystemId: SEED_IDS.systems.bdComp,
    code: 'UNIV_ADMISSION',
    name: 'University Admission (Engineering / Medical / Varsity)',
    description: 'BUET, CKRUET, Medical, Dhaka University Ka-Unit, and GST Admission Preparation.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.levels.bcs,
    educationSystemId: SEED_IDS.systems.bdComp,
    code: 'BCS',
    name: 'BCS & Government Job Preparation',
    description: 'Bangladesh Civil Service (BCS) Preliminary & Written syllabus.',
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.levels.aLevel,
    educationSystemId: SEED_IDS.systems.intlCamb,
    code: 'A_LEVEL',
    name: 'Cambridge AS & A Level',
    description: 'Advanced Subsidiary and Advanced Level international qualification.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const INITIAL_EXAMINATIONS: ExaminationRecord[] = [
  {
    id: SEED_IDS.examinations.hsc2027,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.hsc,
    code: 'HSC-2027',
    name: 'HSC 2027',
    description: 'Bangladesh National Board Higher Secondary Certificate Examination 2027.',
    examDate: new Date('2027-06-15T00:00:00.000Z'),
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.examinations.ssc2027,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.ssc,
    code: 'SSC-2027',
    name: 'SSC 2027',
    description: 'Bangladesh National Board Secondary School Certificate Examination 2027.',
    examDate: new Date('2027-02-15T00:00:00.000Z'),
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.examinations.buetAdm2027,
    educationSystemId: SEED_IDS.systems.bdComp,
    educationLevelId: SEED_IDS.levels.univAdmission,
    code: 'BUET-ADM-2027',
    name: 'Engineering Admission 2027',
    description: 'BUET and Engineering Combined University Admission Examination.',
    examDate: new Date('2027-10-10T00:00:00.000Z'),
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.examinations.bcs47,
    educationSystemId: SEED_IDS.systems.bdComp,
    educationLevelId: SEED_IDS.levels.bcs,
    code: 'BCS-47',
    name: '47th BCS Preliminary',
    description: '47th Bangladesh Civil Service Preliminary Competitive Examination (200 Marks).',
    examDate: new Date('2027-05-20T00:00:00.000Z'),
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const INITIAL_SUBJECTS: SubjectRecord[] = [
  {
    id: SEED_IDS.subjects.hscPhysics,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.hsc,
    examinationIds: [SEED_IDS.examinations.hsc2027, SEED_IDS.examinations.buetAdm2027],
    code: 'HSC-PHY',
    name: 'Physics',
    nameBn: 'পদার্থবিজ্ঞান (১ম ও ২য় পত্র)',
    description: 'HSC Physics 1st & 2nd Paper: Classical Mechanics, Thermodynamics, Electromagnetism, and Modern Physics.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.subjects.hscChemistry,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.hsc,
    examinationIds: [SEED_IDS.examinations.hsc2027, SEED_IDS.examinations.buetAdm2027],
    code: 'HSC-CHEM',
    name: 'Chemistry',
    nameBn: 'রসায়ন (১ম ও ২য় পত্র)',
    description: 'HSC Chemistry 1st & 2nd Paper: Qualitative, Quantitative, Organic, and Electrochemistry.',
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.subjects.hscHigherMath,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.hsc,
    examinationIds: [SEED_IDS.examinations.hsc2027, SEED_IDS.examinations.buetAdm2027],
    code: 'HSC-HMATH',
    name: 'Higher Mathematics',
    nameBn: 'উচ্চতর গণিত (১ম ও ২য় পত্র)',
    description: 'Matrices, Vectors, Trigonometry, Differential & Integral Calculus, Conics, and Statics.',
    order: 3,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.subjects.hscIct,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.hsc,
    examinationIds: [SEED_IDS.examinations.hsc2027],
    code: 'HSC-ICT',
    name: 'Information & Communication Technology (ICT)',
    nameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি',
    description: 'Number Systems, Digital Logic Gates, HTML, C Programming, and Database Management.',
    order: 4,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.subjects.sscPhysics,
    educationSystemId: SEED_IDS.systems.bdNctb,
    educationLevelId: SEED_IDS.levels.ssc,
    examinationIds: [SEED_IDS.examinations.ssc2027],
    code: 'SSC-PHY',
    name: 'SSC Physics',
    nameBn: 'এসএসসি পদার্থবিজ্ঞান',
    description: 'Class 9–10 Motion, Force, Work-Power-Energy, Waves, Optics, and Electricity.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.subjects.bcsBangladeshAffairs,
    educationSystemId: SEED_IDS.systems.bdComp,
    educationLevelId: SEED_IDS.levels.bcs,
    examinationIds: [SEED_IDS.examinations.bcs47],
    code: 'BCS-BD-AFFAIRS',
    name: 'Bangladesh Affairs',
    nameBn: 'বাংলাদেশ বিষয়াবলি',
    description: 'National History, Language Movement, 1971 Liberation War, Constitution, Economy, and Foreign Policy.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const INITIAL_CHAPTERS: ChapterRecord[] = [
  {
    id: SEED_IDS.chapters.hscPhysMechanics,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterNumber: 4,
    title: 'Mechanics',
    titleBn: 'নিউটনীয় বলবিদ্যা (বলবিদ্যা)',
    description: 'Newtonian mechanics, force, momentum conservation, angular momentum, torque, and work-energy theorem.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.chapters.hscPhysThermo,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterNumber: 5,
    title: 'Thermodynamics',
    titleBn: 'তাপগতিবিদ্যা',
    description: 'Zeroth, First, and Second laws of thermodynamics, isothermal/adiabatic processes, Carnot cycle, and entropy.',
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.chapters.hscChemOrganic,
    subjectId: SEED_IDS.subjects.hscChemistry,
    chapterNumber: 2,
    title: 'Organic Chemistry',
    titleBn: 'জৈব রসায়ন',
    description: 'Homologous series, isomerism, aromaticity, substitution/elimination mechanisms, and functional group tests.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.chapters.hscMathCalculus,
    subjectId: SEED_IDS.subjects.hscHigherMath,
    chapterNumber: 9,
    title: 'Differential & Integral Calculus',
    titleBn: 'অন্তরীকরণ ও যোগজীকরণ (ক্যালকুলাস)',
    description: 'Limits, continuity, derivatives, maxima/minima, indefinite and definite integrals, and area bounded by curves.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.chapters.hscIctDigitalLogic,
    subjectId: SEED_IDS.subjects.hscIct,
    chapterNumber: 3,
    title: 'Number Systems & Digital Devices',
    titleBn: 'সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস',
    description: 'Base conversions, 2s complement arithmetic, Boolean algebra, De Morgan theorems, Logic Gates, Adder & Flip-Flops.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.chapters.bcsBdHistory,
    subjectId: SEED_IDS.subjects.bcsBangladeshAffairs,
    chapterNumber: 1,
    title: 'National History & Liberation War of Bangladesh',
    titleBn: 'বাংলাদেশের জাতীয় ইতিহাস ও মহান মুক্তিযুদ্ধ',
    description: '1952 Language Movement, 1966 Six-Point Charter, 1969 Mass Uprising, and 1971 War of Liberation.',
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const INITIAL_TOPICS: TopicRecord[] = [
  {
    id: SEED_IDS.topics.newtonsLaws,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterId: SEED_IDS.chapters.hscPhysMechanics,
    code: 'PHY-MECH-01',
    title: "Newton's Laws of Motion",
    titleBn: 'নিউটনের গতিসূত্র ও বলের ধারণা',
    description:
      'Formulation and application of Newton’s three laws of motion, inertial frames, impulse of a force, and free-body diagrams.',
    learningObjectives: [
      "State and apply Newton's First, Second (F = dp/dt), and Third Laws of Motion.",
      'Construct free-body diagrams for connected bodies, pulleys, and inclined planes.',
      'Calculate impulse and average force from force-time graphs.',
    ],
    prerequisiteTopicIds: [],
    difficulty: 'medium',
    estimatedMinutes: 50,
    keyConcepts: [
      'Inertia & Inertial Frames',
      'Rate of Change of Linear Momentum (F = ma)',
      'Impulse-Momentum Theorem (J = Δp)',
      'Action-Reaction Pairs & Tension',
    ],
    curriculumReferences: ['NCTB HSC Physics 1st Paper Chapter 4.1–4.4', 'HSC 2027 Syllabus Core'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 95,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.conservationOfMomentum,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterId: SEED_IDS.chapters.hscPhysMechanics,
    code: 'PHY-MECH-02',
    title: 'Conservation of Momentum & Elastic Collisions',
    titleBn: 'ভরবেগের সংরক্ষণশীলতা ও স্থিতিস্থাপক সংঘর্ষ',
    description:
      'Derivation of conservation of linear momentum in isolated systems, one-dimensional elastic and inelastic collisions, and rocket propulsion.',
    learningObjectives: [
      'Derive final velocities v1 and v2 after a 1D elastic collision.',
      'Distinguish between elastic and inelastic collisions using kinetic energy conservation.',
      'Solve recoil and variable-mass rocket thrust numerical problems.',
    ],
    prerequisiteTopicIds: [SEED_IDS.topics.newtonsLaws],
    difficulty: 'hard',
    estimatedMinutes: 60,
    keyConcepts: [
      'Isolated System Momentum Conservation',
      '1D Elastic Collision Velocity Formulas',
      'Coefficient of Restitution',
      'Rocket Thrust Equation',
    ],
    curriculumReferences: ['NCTB HSC Physics 1st Paper Chapter 4.5–4.8'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 90,
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.workEnergyPower,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterId: SEED_IDS.chapters.hscPhysMechanics,
    code: 'PHY-MECH-03',
    title: 'Work-Energy Theorem & Conservation of Mechanical Energy',
    titleBn: 'কাজ-শক্তি উপপাদ্য ও যান্ত্রিক শক্তির নিত্যতা',
    description:
      'Work done by constant and variable forces, spring potential energy, work-energy theorem, and mechanical energy conservation.',
    learningObjectives: [
      'Compute work done by a variable force using definite integration W = ∫F·dx.',
      'Prove and apply the Work-Energy Theorem (W_net = ΔK).',
      'Analyze vertical pendulums and spring-mass systems using energy conservation.',
    ],
    prerequisiteTopicIds: [SEED_IDS.topics.newtonsLaws],
    difficulty: 'medium',
    estimatedMinutes: 45,
    keyConcepts: ['Dot Product W = F·s cosθ', 'Hooke Law & Spring Energy (½kx²)', 'Work-Energy Theorem', 'Power P = F·v'],
    curriculumReferences: ['NCTB HSC Physics 1st Paper Chapter 5'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 88,
    order: 3,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.lawsOfThermodynamics,
    subjectId: SEED_IDS.subjects.hscPhysics,
    chapterId: SEED_IDS.chapters.hscPhysThermo,
    code: 'PHY-THERM-01',
    title: 'First & Second Laws of Thermodynamics and Carnot Cycle',
    titleBn: 'তাপগতিবিদ্যার প্রথম ও দ্বিতীয় সূত্র এবং কার্নো চক্র',
    description:
      'Internal energy, work done in isothermal and adiabatic expansions, Carnot heat engine efficiency, and entropy change.',
    learningObjectives: [
      'Apply dQ = dU + dW across isothermal, isobaric, isochoric, and adiabatic processes.',
      'Derive work done in adiabatic expansion and PV^γ = constant.',
      'Calculate thermal efficiency η = 1 - T2/T1 and entropy change ΔS = ∫dQ/T.',
    ],
    prerequisiteTopicIds: [SEED_IDS.topics.workEnergyPower],
    difficulty: 'hard',
    estimatedMinutes: 65,
    keyConcepts: [
      'First Law (dQ = dU + PdV)',
      'Molar Heat Capacities Cp - Cv = R',
      'Carnot Engine Efficiency',
      'Entropy & Irreversibility',
    ],
    curriculumReferences: ['NCTB HSC Physics 2nd Paper Chapter 1'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 92,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.hydrocarbonsReactions,
    subjectId: SEED_IDS.subjects.hscChemistry,
    chapterId: SEED_IDS.chapters.hscChemOrganic,
    code: 'CHEM-ORG-01',
    title: 'Electrophilic & Nucleophilic Substitution (SN1, SN2, Benzene)',
    titleBn: 'ইলেকট্রোফিলিক ও নিউক্লিওফিলিক প্রতিস্থাপন বিক্রিয়া (SN1, SN2 ও বেনজিন)',
    description:
      'Reaction mechanisms of alkyl halides (SN1 vs SN2, E1 vs E2) and aromatic electrophilic substitution in benzene rings.',
    learningObjectives: [
      'Compare SN1 and SN2 mechanisms in terms of kinetics, stereochemistry, and carbocation stability.',
      'Explain nitration, halogenation, and Friedel-Crafts alkylation/acylation of benzene.',
      'Predict ortho/para vs meta directing effects of substituent groups.',
    ],
    prerequisiteTopicIds: [],
    difficulty: 'hard',
    estimatedMinutes: 60,
    keyConcepts: ['Carbocation Stability (3° > 2° > 1°)', 'Walden Inversion in SN2', 'Friedel-Crafts Reaction', 'Ortho/Para Directors'],
    curriculumReferences: ['NCTB HSC Chemistry 2nd Paper Chapter 2'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 94,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.limitsAndDerivatives,
    subjectId: SEED_IDS.subjects.hscHigherMath,
    chapterId: SEED_IDS.chapters.hscMathCalculus,
    code: 'HMATH-CALC-01',
    title: 'Limits, Continuity & Differentiation Rules',
    titleBn: 'লিমিট, অবিচ্ছিন্নতা ও অন্তরীকরণ সূত্রাবলি',
    description:
      'Evaluation of algebraic, trigonometric, and exponential limits, L’Hôpital’s rule, chain rule, implicit differentiation, and extrema.',
    learningObjectives: [
      'Evaluate indeterminate limits (0/0, ∞/∞) using standard identities and L’Hôpital’s rule.',
      'Differentiate composite, implicit, parametric, and logarithmic functions.',
      'Determine tangent/normal equations and local maxima/minima of functions.',
    ],
    prerequisiteTopicIds: [],
    difficulty: 'medium',
    estimatedMinutes: 55,
    keyConcepts: ['Standard Limit lim(x→0) sin(x)/x = 1', 'Chain & Product Rules', 'Implicit Differentiation', 'Second Derivative Test'],
    curriculumReferences: ['NCTB HSC Higher Math 1st Paper Chapter 9'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 96,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.definiteIntegration,
    subjectId: SEED_IDS.subjects.hscHigherMath,
    chapterId: SEED_IDS.chapters.hscMathCalculus,
    code: 'HMATH-CALC-02',
    title: 'Definite Integration & Area Under Curves',
    titleBn: 'নির্দিষ্ট যোগজীকরণ ও বক্ররেখা দ্বারা আবদ্ধ ক্ষেত্রফল',
    description:
      'Integration by substitution, integration by parts, partial fractions, fundamental theorem of calculus, and area between curves.',
    learningObjectives: [
      'Apply integration by parts ∫u dv = uv - ∫v du and substitution techniques.',
      'Evaluate definite integrals using properties of symmetric intervals.',
      'Compute area bounded by parabolas, circles, ellipses, and lines.',
    ],
    prerequisiteTopicIds: [SEED_IDS.topics.limitsAndDerivatives],
    difficulty: 'hard',
    estimatedMinutes: 60,
    keyConcepts: ['Fundamental Theorem of Calculus', 'Integration by Parts (LIATE)', 'Area ∫(y1 - y2)dx', 'Reduction Formulas'],
    curriculumReferences: ['NCTB HSC Higher Math 1st Paper Chapter 10'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 93,
    order: 2,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.booleanAlgebraGates,
    subjectId: SEED_IDS.subjects.hscIct,
    chapterId: SEED_IDS.chapters.hscIctDigitalLogic,
    code: 'ICT-DIG-01',
    title: 'Boolean Algebra, De Morgan’s Theorems & Universal Logic Gates',
    titleBn: 'বুলিয়ান অ্যালজেব্রা, ডি-মরগ্যানের উপপাদ্য ও সার্বজনীন গেট',
    description:
      'Boolean simplification, truth tables, De Morgan’s laws, and implementation of basic/compound circuits using NAND and NOR universal gates.',
    learningObjectives: [
      'Simplify Boolean expressions using Boolean postulates and De Morgan’s theorems.',
      'Implement AND, OR, NOT, and XOR gates exclusively using NAND or NOR gates.',
      'Design Half-Adder and Full-Adder combinational logic circuits.',
    ],
    prerequisiteTopicIds: [],
    difficulty: 'easy',
    estimatedMinutes: 40,
    keyConcepts: ['De Morgan’s Theorems', 'NAND & NOR Universal Gates', 'XOR / XNOR Truth Tables', 'Half & Full Adder'],
    curriculumReferences: ['NCTB HSC ICT Chapter 3.2'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 91,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: SEED_IDS.topics.liberationWar1971,
    subjectId: SEED_IDS.subjects.bcsBangladeshAffairs,
    chapterId: SEED_IDS.chapters.bcsBdHistory,
    code: 'BCS-HIST-01',
    title: 'Language Movement (1952) to Great Liberation War (1971)',
    titleBn: '১৯৫২-এর ভাষা আন্দোলন থেকে ১৯৭১-এর মহান মুক্তিযুদ্ধ',
    description:
      'Chronological constitutional and political milestones from 1947 Partition, 1952 Language Movement, 1954 United Front, 1966 Six Points, 1970 Election, Mujibnagar Government, and 11 Sectors of the 1971 Liberation War.',
    learningObjectives: [
      'Identify key dates, leaders, and constitutional outcomes between 1948 and 1971.',
      'Analyze the structure and portfolio distribution of the Mujibnagar Government (10 April 1971).',
      'Map the 11 operational sectors, sector commanders, and gallantry awards (Bir Sreshtho).',
    ],
    prerequisiteTopicIds: [],
    difficulty: 'medium',
    estimatedMinutes: 50,
    keyConcepts: ['1952 Language Movement', '1966 Six-Point Charter', 'Mujibnagar Government', '11 Sectors & 7 Bir Sreshtho'],
    curriculumReferences: ['BPSC BCS Preliminary Syllabus — Bangladesh Affairs Section 1'],
    syllabusWeightVerified: true,
    syllabusPriorityScore: 98,
    order: 1,
    isActive: true,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];
