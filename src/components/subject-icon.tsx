import {
  Activity,
  Baby,
  Bone,
  Brain,
  Bug,
  Ear,
  Eye,
  FlaskConical,
  Hand,
  HeartPulse,
  Layers,
  Microscope,
  PersonStanding,
  Pill,
  Scale,
  ScanLine,
  Scissors,
  Stethoscope,
  Syringe,
  ToyBrick,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Anaesthesia: Syringe,
  Anatomy: PersonStanding,
  Biochemistry: FlaskConical,
  ENT: Ear,
  "Forensic Medicine": Scale,
  "Gynaecology & Obstetrics": Baby,
  Medicine: Stethoscope,
  Microbiology: Bug,
  Ophthalmology: Eye,
  Orthopaedics: Bone,
  Pathology: Microscope,
  Pediatrics: ToyBrick,
  Pharmacology: Pill,
  Physiology: HeartPulse,
  Psychiatry: Brain,
  Radiology: ScanLine,
  Skin: Hand,
  "Social & Preventive Medicine": Users,
  Surgery: Scissors,
};

/** Shorter labels where MedMCQA's subject names are long or unclear. */
const LABELS: Record<string, string> = {
  "Gynaecology & Obstetrics": "OBG",
  "Social & Preventive Medicine": "PSM",
  Skin: "Dermatology",
};

export function subjectLabel(name: string) {
  return LABELS[name] ?? name;
}

export function SubjectIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = name === null ? Layers : (ICONS[name] ?? Activity);
  return <Icon aria-hidden className={cn("size-4", className)} />;
}
