import { Component } from '@angular/core';
import { LeaderboardComponent } from './leaderboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LeaderboardComponent],
  template: `<app-leaderboard />`,
  styles: [':host { display: block; }']
})
export class AppComponent {}
