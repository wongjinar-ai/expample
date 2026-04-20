export type Assignee = 'KTC' | 'ACF' | 'GM' | 'CEO' | 'Anyone Free' | 'All Staff' | '-'

export interface Task {
  name: string
  section: 'Accommodation & Farm' | 'Kitchen' | 'Office'
  time: string
  days: [Assignee, Assignee, Assignee, Assignee, Assignee, Assignee, Assignee] // Mon–Sun
}

export const TASKS: Task[] = [
  // ── Accommodation & Farm ──────────────────────────────────────────────────
  { name: 'Farm morning walk & harvest',    section: 'Accommodation & Farm', time: '6:00 AM',  days: ['GM',  'GM',  'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Open common areas',              section: 'Accommodation & Farm', time: '7:00 AM',  days: ['GM',  'GM',  'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Clean the dishes / restock plate', section: 'Accommodation & Farm', time: '8:00 AM', days: ['KTC', 'KTC', 'KTC', 'ACF', 'KTC', 'KTC', 'KTC'] },
  { name: 'Housekeeping — check-out rooms', section: 'Accommodation & Farm', time: '10:00 AM', days: ['GM',  'GM',  'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Room inspection before 2 PM',    section: 'Accommodation & Farm', time: '1:30 PM',  days: ['GM',  'GM',  'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Guest check-ins (2 PM+)',        section: 'Accommodation & Farm', time: '2:00 PM',  days: ['Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free'] },
  { name: 'Farm & garden work',             section: 'Accommodation & Farm', time: '3:00 PM',  days: ['GM',  'GM',  'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Evening walkthrough',            section: 'Accommodation & Farm', time: '7:00 PM',  days: ['KTC', 'KTC', 'KTC', 'ACF', 'KTC', 'KTC', 'KTC'] },
  { name: 'Confirm next-day arrivals',      section: 'Accommodation & Farm', time: '8:00 PM',  days: ['GM',  'GM',  'GM',  'GM',  'GM',  'GM',  'GM'] },
  { name: 'Deep linen wash',               section: 'Accommodation & Farm', time: '9:00 AM',  days: ['KTC', 'KTC', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'] },
  { name: 'Common area deep clean',         section: 'Accommodation & Farm', time: '9:00 AM',  days: ['-', '-', 'All Staff', '-', '-', 'All Staff', '-'] },
  { name: 'AM farm activity (if booked)',   section: 'Accommodation & Farm', time: '8:00 AM',  days: ['-', '-', '-', '-', '-', '-', '-'] },

  // ── Kitchen ───────────────────────────────────────────────────────────────
  { name: 'Receive harvest & sign log',     section: 'Kitchen', time: '10:00 AM', days: ['KTC', 'KTC', 'KTC', 'GM',  'KTC', 'KTC', 'KTC'] },
  { name: 'Kitchen prep / dough / seasoning / restock', section: 'Kitchen', time: '10:00 AM', days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'] },
  { name: 'Opening music / online ordering app', section: 'Kitchen', time: '10:30 AM', days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'] },
  { name: 'Market run (local — weekly)',    section: 'Kitchen', time: '8:00 AM',  days: ['KTC', '-',   '-',   '-',   '-',   '-',   '-'] },
  { name: 'Lunch service 11 AM–2 PM',       section: 'Kitchen', time: '11:00 AM', days: ['KTC', 'KTC', 'KTC', 'GM',  'KTC', 'KTC', 'KTC'] },
  { name: 'Evening service 5–8 PM',         section: 'Kitchen', time: '5:00 PM',  days: ['KTC', 'KTC', 'KTC', 'GM',  'KTC', 'KTC', 'KTC'] },
  { name: 'Kitchen closing checklist',      section: 'Kitchen', time: '8:00 PM',  days: ['KTC', 'KTC', 'KTC', 'GM',  'KTC', 'KTC', 'KTC'] },
  { name: 'Prep for next day / Yeast refill', section: 'Kitchen', time: '8:30 PM', days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'] },
  { name: 'Cook Yeast, Tomatoes, Yogurt, Cheese', section: 'Kitchen', time: '9:00 AM', days: ['-', 'GM', '-', '-', '-', 'GM', '-'] },
  { name: 'Fridge deep clean',              section: 'Kitchen', time: '9:00 AM',  days: ['-',   '-',   '-',   '-',   '-',   '-',   'KTC'] },
  { name: 'Full inventory check',           section: 'Kitchen', time: '9:00 AM',  days: ['-',   '-',   '-',   '-',   '-',   '-',   'KTC'] },

  // ── Office ────────────────────────────────────────────────────────────────
  { name: 'Check bookings & OTA messages',  section: 'Office', time: '9:00 AM',  days: ['GM',  'GM',  'GM',  'GM',  'GM',  'GM',  'GM'] },
  { name: 'Review daily sales',            section: 'Office', time: '9:30 AM',  days: ['GM',  'GM',  'GM',  'GM',  'GM',  'GM',  'GM'] },
  { name: 'Expense logging',               section: 'Office', time: '10:00 AM', days: ['GM',  'GM',  'GM',  'GM',  'GM',  'GM',  'GM'] },
  { name: 'Weekly revenue review',         section: 'Office', time: '10:00 AM', days: ['GM',  '-',   '-',   '-',   '-',   '-',   '-'] },
  { name: 'Supplier calls / stock order',  section: 'Office', time: '11:00 AM', days: ['-',   'GM',  '-',   '-',   'GM',  '-',   '-'] },
  { name: 'R&D recipe test',              section: 'Office', time: '2:00 PM',  days: ['-',   '-',   '-',   'GM',  '-',   'GM',  '-'] },
  { name: 'Post social media content',     section: 'Office', time: '10:00 AM', days: ['CEO', 'CEO', 'CEO', 'CEO', 'CEO', 'CEO', 'CEO'] },
  { name: 'Marketing content schedule',    section: 'Office', time: '2:00 PM',  days: ['-',   '-',   'CEO', '-',   '-',   'CEO', 'CEO'] },
]
