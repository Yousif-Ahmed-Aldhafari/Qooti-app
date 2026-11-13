export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type EquipmentType =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'cable'
  | 'machine'
  | 'resistance-band';

export type MovementCategory =
  | 'compound'
  | 'isolation';

export type CatalogExercise = {
  id: string;
  nameEn: string;
  nameAr: string;
  aliasesEn: string[];
  aliasesAr: string[];
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentType;
  category: MovementCategory;
  instructionsEn?: string;
  instructionsAr?: string;
};

export type CatalogSearchFilter = {
  query?: string;
  muscleGroup?: MuscleGroup | 'all';
  equipment?: EquipmentType | 'all';
  language?: 'en' | 'ar';
};
