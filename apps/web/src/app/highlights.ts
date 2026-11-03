/** Dashboard banner: new features and highlighted modules. Newest first; an entry without `to` shows as a teaser. */
export interface Highlight {
  /** stable: dismissals are remembered by id */
  id: string;
  title: string;
  blurb: string;
  /** shown only when this course is installed */
  course?: string;
  to?: string;
  badge: 'New' | 'Coming soon' | 'Today';
  /** Christmas styling (see christmas/banner.ts) */
  festive?: boolean;
}

export const HIGHLIGHTS: Highlight[] = [
  {
    // replaces the 'bdcc-notebook-quiz-sim' teaser; a new id so learners who dismissed the teaser see it's live
    id: 'bdcc-midterm-mock-exam',
    title: 'Midterm mock exam',
    blurb: 'Four midterm-style problems on one dataset (utility matrix, item-based recommendations, frequent tags, strong rules), timed, with new data every attempt.',
    course: 'BDCC',
    to: '/m/pandas-select-rows/exam',
    badge: 'New',
  },
];
