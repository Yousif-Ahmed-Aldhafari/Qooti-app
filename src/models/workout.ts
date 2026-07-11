export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  duration: number;
  notes: string;
};

export type Workout = {
  id: string;
  name: string;
  date: string;
  time: string;
  exercises: Exercise[];
  notes: string;
};
