import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ALL_CATEGORIES, generateUsers } from './mock-data';
import {
  Activity,
  ActivityCategory,
  Quarter,
  User,
  UserView
} from './models';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss'
})
export class LeaderboardComponent {
  readonly allCategories = ALL_CATEGORIES;
  readonly quarters: Quarter[] = ['All', 'Q1', 'Q2', 'Q3', 'Q4'];

  private readonly users: User[] = generateUsers();

  readonly availableYears = computed(() => {
    const set = new Set<number>();
    for (const u of this.users) {
      for (const a of u.activities) {
        set.add(Number(a.date.slice(0, 4)));
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  });

  // Filters
  year = signal<number | 'All'>(2025);
  quarter = signal<Quarter>('All');
  category = signal<ActivityCategory | 'All'>('All');
  search = signal<string>('');

  expanded = signal<Set<string>>(new Set());

  readonly filteredUsers = computed<UserView[]>(() => {
    const year = this.year();
    const quarter = this.quarter();
    const category = this.category();
    const search = this.search().trim().toLowerCase();

    const inQuarter = (date: string): boolean => {
      if (quarter === 'All') return true;
      const m = Number(date.slice(5, 7));
      const q = Math.ceil(m / 3); // 1..4
      return `Q${q}` === quarter;
    };

    const matchesActivityFilters = (a: Activity): boolean => {
      if (year !== 'All' && Number(a.date.slice(0, 4)) !== year) return false;
      if (!inQuarter(a.date)) return false;
      if (category !== 'All' && a.category !== category) return false;
      return true;
    };

    const views: UserView[] = this.users
      .filter(u =>
        !search ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search)
      )
      .map(u => {
        const filteredActs = u.activities.filter(matchesActivityFilters);
        const totalPoints = filteredActs.reduce((s, a) => s + a.points, 0);
        const countsByCategory: Record<ActivityCategory, number> = {
          'Public Speaking': 0,
          Education: 0,
          Partnership: 0
        };
        for (const a of filteredActs) countsByCategory[a.category]++;
        return {
          ...u,
          activities: filteredActs,
          rank: 0,
          totalPoints,
          countsByCategory
        };
      })
      .filter(u => u.totalPoints > 0 || !!search)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    views.forEach((v, i) => (v.rank = i + 1));
    return views;
  });

  readonly podium = computed(() => {
    const list = this.filteredUsers();
    return {
      first: list[0],
      second: list[1],
      third: list[2]
    };
  });

  toggle(id: string) {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  fullName(u: User): string {
    return `${u.firstName} ${u.lastName}`;
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${String(d).padStart(2, '0')}-${months[m - 1]}-${y}`;
  }

  trackById = (_: number, u: { id: string }) => u.id;

  onYearChange(value: string) {
    this.year.set(value === 'All' ? 'All' : Number(value));
  }
}
