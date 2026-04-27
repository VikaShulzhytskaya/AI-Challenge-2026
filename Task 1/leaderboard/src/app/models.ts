export type ActivityCategory = 'Public Speaking' | 'Education' | 'Partnership';

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  date: string; // ISO yyyy-mm-dd
  points: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  avatar: string;
  activities: Activity[];
}

export interface UserView extends User {
  rank: number;
  totalPoints: number;
  countsByCategory: Record<ActivityCategory, number>;
}

export type Quarter = 'All' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
