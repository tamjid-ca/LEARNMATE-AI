import type { Metadata } from 'next';
import { CustomEducationStudio } from '@/components/education/custom-education-studio';

export const metadata: Metadata = {
  title: 'Custom Education System & Labels',
};

export default function EducationSettingsPage() {
  return <CustomEducationStudio />;
}
