import { Activity, ActivityCategory, User } from './models';

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael',
  'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan',
  'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Margaret', 'Mark',
  'Betty', 'Donald', 'Sandra', 'Steven', 'Ashley', 'Paul', 'Emily',
  'Andrew', 'Kimberly', 'Joshua', 'Donna', 'Kenneth', 'Michelle'
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];
const POSITIONS = [
  'Senior Software Engineer', 'Group Manager', 'Lead QA Engineer',
  'QA Engineer', 'Software Engineer', 'Product Manager',
  'Technical Lead', 'Engineering Manager', 'Designer', 'DevOps Engineer'
];

const ACTIVITY_TEMPLATES: Record<ActivityCategory, { name: string; points: number }[]> = {
  'Public Speaking': [
    { name: 'Speaker at Internal Tech Talk', points: 64 },
    { name: 'External Conference Talk', points: 128 },
    { name: 'Meetup Presentation', points: 64 },
    { name: 'Panel Discussion at Industry Event', points: 96 },
    { name: 'Webinar for Vention Employees', points: 32 }
  ],
  'Education': [
    { name: 'Mentoring of Junior Engineers', points: 64 },
    { name: 'Internal Workshop on Testing', points: 16 },
    { name: 'Onboarding Session for New Hires', points: 16 },
    { name: 'Code Review Best Practices Session', points: 16 },
    { name: 'Technical Article Publication', points: 32 },
    { name: 'Internship Program Lead', points: 64 }
  ],
  'Partnership': [
    { name: 'Client Workshop Facilitation', points: 48 },
    { name: 'Cross-team Collaboration Initiative', points: 32 },
    { name: 'Customer Success Case Study', points: 64 },
    { name: 'University Partnership Program', points: 96 }
  ]
};

const CATEGORIES: ActivityCategory[] = ['Public Speaking', 'Education', 'Partnership'];

function rand(seed: { v: number }): number {
  // simple deterministic LCG so reload looks the same
  seed.v = (seed.v * 1664525 + 1013904223) % 4294967296;
  return seed.v / 4294967296;
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function randomDate(year: number, r: () => number): string {
  const month = Math.floor(r() * 12);
  const day = 1 + Math.floor(r() * 28);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function generateUsers(): User[] {
  const seed = { v: 42 };
  const r = () => rand(seed);
  const users: User[] = [];
  const usedNames = new Set<string>();
  const count = 14;

  for (let i = 0; i < count; i++) {
    let firstName = '';
    let lastName = '';
    let combo = '';
    let attempts = 0;
    do {
      firstName = pick(FIRST_NAMES, r);
      lastName = pick(LAST_NAMES, r);
      combo = `${firstName} ${lastName}`;
      attempts++;
    } while (usedNames.has(combo) && attempts < 50);
    usedNames.add(combo);

    const position = pick(POSITIONS, r);
    const avatar = `https://i.pravatar.cc/150?img=${(i * 3 + 5) % 70 + 1}`;

    const activities: Activity[] = [];
    const years = [2024, 2025];
    const activityCount = 8 + Math.floor(r() * 18); // 8..25 per user

    for (let j = 0; j < activityCount; j++) {
      const cat = pick(CATEGORIES, r);
      const tmpl = pick(ACTIVITY_TEMPLATES[cat], r);
      const year = pick(years, r);
      activities.push({
        id: `${i}-${j}`,
        name: tmpl.name,
        category: cat,
        date: randomDate(year, r),
        points: tmpl.points
      });
    }

    activities.sort((a, b) => b.date.localeCompare(a.date));

    users.push({
      id: `u${i}`,
      firstName,
      lastName,
      position,
      avatar,
      activities
    });
  }

  return users;
}

export const ALL_CATEGORIES: ActivityCategory[] = CATEGORIES;
