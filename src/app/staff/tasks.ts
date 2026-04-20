export type Assignee = 'KTC' | 'ACF' | 'GM' | 'CEO' | 'Anyone Free' | 'All Staff' | '-'

export type SlotType = 'Morning' | 'Mid day' | 'Afternoon' | 'Evening'

export const SLOT_LABELS: Record<SlotType, string> = {
  'Morning':   'Morning (7–11)',
  'Mid day':   'Mid day (11–14)',
  'Afternoon': 'Afternoon (14–18)',
  'Evening':   'Evening (18–22)',
}

export function timeToSlot(time: string): SlotType {
  const match = time.match(/(\d+)(?::\d+)?\s*(AM|PM)/i)
  if (!match) return 'Morning'
  let hour = parseInt(match[1])
  const ampm = match[2].toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  if (hour < 11) return 'Morning'
  if (hour < 14) return 'Mid day'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export interface Task {
  name: string
  section: 'Accommodation & Farm' | 'Kitchen' | 'Office'
  time: string
  days: [Assignee, Assignee, Assignee, Assignee, Assignee, Assignee, Assignee] // Mon–Sun
  instructions: string[]
}

export const TASKS: Task[] = [
  // ── Accommodation & Farm ──────────────────────────────────────────────────
  {
    name: 'Farm morning walk & harvest',
    section: 'Accommodation & Farm', time: '6:00 AM',
    days: ['GM', 'GM', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Walk all garden paths and inspect crop health',
      'Harvest ripe vegetables, herbs, and fruit — place in harvest basket',
      'Note any damaged or diseased plants in the farm log',
      'Water any dry beds before 7 AM',
      'Bring harvest to kitchen and record quantity in harvest log',
    ],
  },
  {
    name: 'Open common areas',
    section: 'Accommodation & Farm', time: '7:00 AM',
    days: ['GM', 'GM', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Unlock reception, lobby, and outdoor seating areas',
      'Turn on ambient music (playlist "Morning — Himmapun")',
      'Check that cushions and furniture are clean and arranged correctly',
      'Refill welcome water station and place fresh flowers if available',
      'Confirm Wi-Fi password display is visible at reception',
    ],
  },
  {
    name: 'Clean the dishes / restock plate',
    section: 'Accommodation & Farm', time: '8:00 AM',
    days: ['KTC', 'KTC', 'KTC', 'ACF', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Collect all dishes from the previous night',
      'Wash, rinse, and dry all plates, cups, and cutlery',
      'Restock the plate shelf and cutlery station',
      'Check for any chipped or cracked items — remove from service',
      'Wipe down the dish rack and sink area',
    ],
  },
  {
    name: 'Housekeeping — check-out rooms',
    section: 'Accommodation & Farm', time: '10:00 AM',
    days: ['GM', 'GM', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Collect dirty linen and towels from all checked-out rooms',
      'Sweep and mop floors',
      'Wipe down all surfaces: desk, shelves, bathroom',
      'Replace toiletries (soap, shampoo, toilet paper)',
      'Make fresh bed with clean linen',
      'Empty and clean rubbish bins',
      'Final check: doors and windows secure, no guest items left behind',
    ],
  },
  {
    name: 'Room inspection before 2 PM',
    section: 'Accommodation & Farm', time: '1:30 PM',
    days: ['GM', 'GM', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Enter each cleaned room with the inspection checklist',
      'Check bed linen is straight and pillow arrangement correct',
      'Verify all toiletries are stocked and towels are folded neatly',
      'Test that lights, fan, and air conditioning work',
      'Confirm no odour — spray room freshener if needed',
      'Mark room as "Ready" on the cleaning status board',
    ],
  },
  {
    name: 'Guest check-ins (2 PM+)',
    section: 'Accommodation & Farm', time: '2:00 PM',
    days: ['Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free', 'Anyone Free'],
    instructions: [
      'Greet guests warmly at reception and offer welcome drink',
      'Verify name against booking and confirm room assignment',
      'Collect TM30 information (nationality, passport number, dates)',
      'Walk guest to room and explain facilities: fan, AC, Wi-Fi, breakfast time',
      'Show them the common areas, farm walk route, and kitchen hours',
      'Record check-in time in the booking system',
    ],
  },
  {
    name: 'Farm & garden work',
    section: 'Accommodation & Farm', time: '3:00 PM',
    days: ['GM', 'GM', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Water all garden beds thoroughly',
      'Remove weeds from vegetable rows',
      'Apply compost or fertiliser to beds that need it (check schedule)',
      'Prune overgrown plants and dispose of cuttings',
      'Check irrigation lines for blockages',
    ],
  },
  {
    name: 'Evening walkthrough',
    section: 'Accommodation & Farm', time: '7:00 PM',
    days: ['KTC', 'KTC', 'KTC', 'ACF', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Walk all common areas and pathways — check lighting is working',
      'Ensure all outdoor furniture is secured',
      'Check if any guests need assistance',
      'Lock any areas that should be closed after dark',
      'Note any maintenance issues in the logbook',
    ],
  },
  {
    name: 'Confirm next-day arrivals',
    section: 'Accommodation & Farm', time: '8:00 PM',
    days: ['GM', 'GM', 'GM', 'GM', 'GM', 'GM', 'GM'],
    instructions: [
      'Open the booking system and check tomorrow\'s check-ins',
      'Send a WhatsApp confirmation to each arriving guest',
      'Confirm estimated arrival time and note any special requests',
      'Ensure the correct room is assigned and cleaned',
      'Brief the next shift about arriving guests and any notes',
    ],
  },
  {
    name: 'Deep linen wash',
    section: 'Accommodation & Farm', time: '9:00 AM',
    days: ['KTC', 'KTC', 'ACF', 'ACF', 'ACF', 'ACF', 'ACF'],
    instructions: [
      'Collect all spare linen from storage and any soiled items',
      'Sort into whites and colours — wash separately',
      'Use correct dosage of detergent and softener',
      'Dry fully — do not store damp linen',
      'Fold neatly and return to linen shelf with label facing out',
    ],
  },
  {
    name: 'Common area deep clean',
    section: 'Accommodation & Farm', time: '9:00 AM',
    days: ['-', '-', 'All Staff', '-', '-', 'All Staff', '-'],
    instructions: [
      'All staff participate — assign zones at start of session',
      'Sweep and mop all floors including under furniture',
      'Wipe walls, light switches, door handles',
      'Clean windows and mirrors with glass cleaner',
      'Scrub bathroom tiles and fixtures',
      'Reorganise shelves and storage areas',
      'Dispose of accumulated rubbish',
    ],
  },
  {
    name: 'AM farm activity (if booked)',
    section: 'Accommodation & Farm', time: '8:00 AM',
    days: ['-', '-', '-', '-', '-', '-', '-'],
    instructions: [
      'Confirm activity booking the night before',
      'Prepare tools: gloves, baskets, small spades',
      'Brief guests on farm safety and what to expect',
      'Guide the activity — harvesting, planting, or composting',
      'Offer farm-fresh refreshments at the end',
      'Record guest feedback in the activity log',
    ],
  },

  // ── Kitchen ───────────────────────────────────────────────────────────────
  {
    name: 'Receive harvest & sign log',
    section: 'Kitchen', time: '10:00 AM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Meet the farm team at kitchen delivery point',
      'Weigh or count each item and record in the harvest log',
      'Check freshness — reject any damaged produce',
      'Store immediately: refrigerate leafy greens, keep root veg at room temp',
      'Sign the log and file it in the kitchen folder',
    ],
  },
  {
    name: 'Kitchen prep / dough / seasoning / restock',
    section: 'Kitchen', time: '10:00 AM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Check the prep list from yesterday\'s closing note',
      'Prepare dough if bread or pizza is on the menu',
      'Mix and portion seasoning blends',
      'Chop vegetables and portion proteins for service',
      'Restock condiments, napkins, and cutlery at each table',
      'Taste all sauces and soups — adjust seasoning',
    ],
  },
  {
    name: 'Opening music / online ordering app',
    section: 'Kitchen', time: '10:30 AM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Turn on kitchen speaker — set to "Service" playlist',
      'Open the online ordering tablet and confirm connection',
      'Check for any pre-orders placed overnight',
      'Set the menu availability — mark unavailable items as sold out',
      'Confirm printer for tickets is loaded and working',
    ],
  },
  {
    name: 'Market run (local — weekly)',
    section: 'Kitchen', time: '8:00 AM',
    days: ['KTC', '-', '-', '-', '-', '-', '-'],
    instructions: [
      'Review the weekly shopping list prepared the day before',
      'Take the cash float and shopping bags',
      'Visit Warorot Market — prioritise fresh herbs, dairy, and proteins',
      'Compare prices and buy from regular trusted vendors',
      'Return by 10 AM — unpack and store items immediately',
      'Submit receipts to GM for expense logging',
    ],
  },
  {
    name: 'Lunch service 11 AM–2 PM',
    section: 'Kitchen', time: '11:00 AM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Station is set up and clean before 11 AM',
      'Fire dishes in order of ticket time — FIFO',
      'Communicate with front-of-house on wait times',
      'Keep work surface clean throughout service',
      'Monitor portion sizes and presentation quality',
      'At 2 PM: wrap down hot foods, clear station, begin prep reset',
    ],
  },
  {
    name: 'Evening service 5–8 PM',
    section: 'Kitchen', time: '5:00 PM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Re-fire station by 4:45 PM — all prep items at hand',
      'Confirm evening specials are ready and communicated',
      'Take orders accurately and fire in sequence',
      'Manage ticket queue — no ticket over 20 minutes',
      'Last order at 7:45 PM — begin close-down at 8 PM',
    ],
  },
  {
    name: 'Kitchen closing checklist',
    section: 'Kitchen', time: '8:00 PM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Turn off all heat sources (stove, oven, grill)',
      'Label and refrigerate all leftover food with date',
      'Scrub and degrease all cooking surfaces',
      'Wash all pots, pans, and utensils',
      'Sweep and mop kitchen floor',
      'Empty and sanitise rubbish bins',
      'Check gas valves are off and record in closing log',
    ],
  },
  {
    name: 'Prep for next day / Yeast refill',
    section: 'Kitchen', time: '8:30 PM',
    days: ['KTC', 'KTC', 'KTC', 'GM', 'KTC', 'KTC', 'KTC'],
    instructions: [
      'Check tomorrow\'s bookings for expected guest count',
      'Write prep list for the morning team',
      'Refill yeast culture — add flour and water at correct ratio',
      'Set dough to prove overnight if needed',
      'Label all prepped items with tomorrow\'s date',
    ],
  },
  {
    name: 'Cook Yeast, Tomatoes, Yogurt, Cheese',
    section: 'Kitchen', time: '9:00 AM',
    days: ['-', 'GM', '-', '-', '-', 'GM', '-'],
    instructions: [
      'Feed yeast culture — stir and check activity',
      'Slow-cook tomato sauce (2 hours minimum) — stir every 30 min',
      'Warm milk to 40°C — add yogurt starter culture, incubate 6–8 hours',
      'Prepare cheese curds if batch is scheduled — follow cheese recipe card',
      'Label all ferments with start time and expected completion',
    ],
  },
  {
    name: 'Fridge deep clean',
    section: 'Kitchen', time: '9:00 AM',
    days: ['-', '-', '-', '-', '-', '-', 'KTC'],
    instructions: [
      'Remove all items from fridge — sort and discard expired items',
      'Remove shelves and wash with hot soapy water',
      'Wipe interior walls with food-safe sanitiser',
      'Check temperature gauge is reading 2–4°C',
      'Restock fridge in FIFO order — older items at front',
      'Record fridge clean in kitchen log',
    ],
  },
  {
    name: 'Full inventory check',
    section: 'Kitchen', time: '9:00 AM',
    days: ['-', '-', '-', '-', '-', '-', 'KTC'],
    instructions: [
      'Use the printed inventory sheet — count every item',
      'Check dry goods (flour, rice, sugar, oil)',
      'Count dairy, proteins, and fresh produce',
      'Note items running low — flag for Monday market run',
      'Compare against last week\'s count — investigate large discrepancies',
      'Submit completed sheet to GM',
    ],
  },

  // ── Office ────────────────────────────────────────────────────────────────
  {
    name: 'Check bookings & OTA messages',
    section: 'Office', time: '9:00 AM',
    days: ['GM', 'GM', 'GM', 'GM', 'GM', 'GM', 'GM'],
    instructions: [
      'Open Booking.com, Agoda, and Airbnb dashboards',
      'Reply to all unanswered guest messages within 1 hour',
      'Update room availability if any last-minute changes',
      'Add new bookings to the master calendar',
      'Flag any special requests to the housekeeping team',
    ],
  },
  {
    name: 'Review daily sales',
    section: 'Office', time: '9:30 AM',
    days: ['GM', 'GM', 'GM', 'GM', 'GM', 'GM', 'GM'],
    instructions: [
      'Open the POS system or sales spreadsheet',
      'Total yesterday\'s food & beverage sales',
      'Compare against target and prior week',
      'Note top-selling and slow-moving items',
      'Record summary in the daily sales log',
    ],
  },
  {
    name: 'Expense logging',
    section: 'Office', time: '10:00 AM',
    days: ['GM', 'GM', 'GM', 'GM', 'GM', 'GM', 'GM'],
    instructions: [
      'Collect all receipts from yesterday',
      'Enter each expense in the accounts tracker (category, amount, paid by)',
      'Photograph receipts and attach to the entry',
      'Reconcile cash float — note any discrepancies',
      'File physical receipts in the monthly folder',
    ],
  },
  {
    name: 'Weekly revenue review',
    section: 'Office', time: '10:00 AM',
    days: ['GM', '-', '-', '-', '-', '-', '-'],
    instructions: [
      'Pull last week\'s income from all sources: rooms, cafe, activities',
      'Compare total against monthly target',
      'Calculate occupancy rate and average daily rate',
      'Identify which OTA channels performed best',
      'Prepare a brief summary to share with CEO',
    ],
  },
  {
    name: 'Supplier calls / stock order',
    section: 'Office', time: '11:00 AM',
    days: ['-', 'GM', '-', '-', 'GM', '-', '-'],
    instructions: [
      'Review low-stock items flagged by the kitchen',
      'Call or message regular suppliers for pricing and availability',
      'Place orders with confirmed delivery dates',
      'Record order details (supplier, items, cost, ETA) in the order log',
      'Share delivery schedule with kitchen team',
    ],
  },
  {
    name: 'R&D recipe test',
    section: 'Office', time: '2:00 PM',
    days: ['-', '-', '-', 'GM', '-', 'GM', '-'],
    instructions: [
      'Choose one new recipe or ingredient to test this session',
      'Prepare the dish following the draft recipe card',
      'Taste and evaluate — note flavour, texture, appearance',
      'Adjust recipe and re-test if needed',
      'Take a photo and write tasting notes in the R&D journal',
      'Decide: add to menu, shelve, or continue testing',
    ],
  },
  {
    name: 'Post social media content',
    section: 'Office', time: '10:00 AM',
    days: ['CEO', 'CEO', 'CEO', 'CEO', 'CEO', 'CEO', 'CEO'],
    instructions: [
      'Select photo or video from the content library',
      'Write caption — keep it warm, local, and on-brand',
      'Add relevant hashtags (#HimmapunRetreat #ChiangMai)',
      'Post to Instagram and Facebook simultaneously',
      'Reply to any comments from the previous post',
      'Check story highlights are up to date',
    ],
  },
  {
    name: 'Marketing content schedule',
    section: 'Office', time: '2:00 PM',
    days: ['-', '-', 'CEO', '-', '-', 'CEO', 'CEO'],
    instructions: [
      'Open the content calendar for the next 7 days',
      'Plan topics: guest stories, farm, food, behind-the-scenes',
      'Schedule posts using Buffer or Meta Business Suite',
      'Draft captions and select images for each scheduled post',
      'Brief anyone contributing content (photos, videos)',
    ],
  },
]
