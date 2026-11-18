/**
 * Deadlines on the Hell Week calendar that no module carries: presentations, quizzes, labs, projects and courses
 * without modules. Exams that already come from a manifest `assessmentDate` (ML2 Final Exam, BDCC Final Exam) are not
 * repeated here. `name` must start with `course` and a space: the calendar chip shows the course, then the rest.
 */
export interface Deadline { course: string; name: string; date: string; time?: string; note?: string }

export const DEADLINES: Deadline[] = [
  { course: 'INTB', name: 'INTB Presentation', date: '2026-11-19', time: '1:30 – 3:00 PM' },
  { course: 'ML2', name: 'ML2 Optional CP', date: '2026-11-19', time: '11:59 PM' },
  { course: 'ML2', name: 'ML2 Final Term Lab 3 & 4', date: '2026-11-20', time: '11:59 PM' },
  { course: 'BDCC', name: 'BDCC Assignment 2', date: '2026-11-21', time: '11:59 PM' },
  { course: 'MIS', name: 'MIS Quiz #11', date: '2026-11-22', time: '1:59 PM' },
  { course: 'ARTS', name: 'ARTS Presentation 2', date: '2026-11-26', time: '11:59 PM' },
  { course: 'MARK', name: 'MARK Final Presentation', date: '2026-11-27', time: '1:30 – 3:00 PM' },
  { course: 'MIS', name: 'MIS Quiz #12', date: '2026-11-29', time: '1:59 PM' },
  { course: 'MIS', name: 'MIS Group Phase E', date: '2026-12-01', time: '1:59 PM' },
  { course: 'ARTS', name: 'ARTS Finals Project', date: '2026-12-02', time: '11:59 PM' },
  { course: 'MIS', name: 'MIS Exam 2', date: '2026-12-03', time: '11:59 PM', note: 'Dec 3 or 4' },
  { course: 'BDCC', name: 'BDCC Final Project Presentation', date: '2026-12-07', time: '1:30 – 5:00 PM' },
];
