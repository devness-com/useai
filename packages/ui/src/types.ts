/** Types shared across UI components (originally from dashboard store) */

export interface Filters {
  category: string;
  client: string;
  project: string;
  language: string;
}

export type ActiveTab = 'sessions' | 'insights' | 'settings';
