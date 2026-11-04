let counter = 0;

export function createId(prefix = 'r'): string {
  counter = (counter + 1) % 10000;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${random}`;
}

export function eventId(reminderId: string, occurrenceAt: string, status: string): string {
  return `e_${reminderId}_${occurrenceAt}_${status}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
