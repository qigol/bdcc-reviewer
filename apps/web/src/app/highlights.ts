/** Dashboard banner: new features and highlighted modules. Newest first; an entry without `to` shows as a teaser. */
export interface Highlight {
  /** stable: dismissals are remembered by id */
  id: string;
  title: string;
  blurb: string;
  /** shown only when this course is installed */
  course?: string;
  to?: string;
  badge: 'New' | 'Coming soon';
}

export const HIGHLIGHTS: Highlight[] = [
  {
    id: 'bdcc-notebook-quiz-sim',
    title: 'Notebook quiz simulation',
    blurb: 'A simulated run of the BDCC notebook quiz, so you can rehearse it before the real one.',
    course: 'BDCC',
    badge: 'Coming soon',
  },
];
