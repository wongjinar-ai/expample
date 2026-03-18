export const ROOMS = [
  'ม่วง', 'ชมพู', 'ขาว',
  'Tent 1', 'Tent 2', 'Tent 3', 'Tent 4',
  'Bungalow 1', 'Bungalow 2', 'Bungalow 3',
  'Extra 1', 'Extra 2',
] as const

export type Room = typeof ROOMS[number]

export const OCC_ROOMS = ROOMS.slice(0, 10) // Excludes Extra 1 & Extra 2

export const ROOM_TYPES: Record<Room, string> = {
  'ม่วง': 'Standard', 'ชมพู': 'Standard', 'ขาว': 'Standard',
  'Tent 1': 'Tent', 'Tent 2': 'Tent', 'Tent 3': 'Tent', 'Tent 4': 'Tent',
  'Bungalow 1': 'Bungalow', 'Bungalow 2': 'Bungalow', 'Bungalow 3': 'Bungalow',
  'Extra 1': 'Extra', 'Extra 2': 'Extra',
}

export const SOURCES = ['Direct', 'Booking.com', 'Agoda', 'Airbnb', 'Other'] as const
export type Source = typeof SOURCES[number]

export const STATUSES = ['Upcoming', 'Check-in', 'Occupied', 'Checkout', 'Completed'] as const
export type Status = typeof STATUSES[number]

export const CLEAN_STATUSES = ['Needs Cleaning', 'In Progress', 'Clean'] as const
export type CleanStatus = typeof CLEAN_STATUSES[number]
