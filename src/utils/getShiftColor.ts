function calculateShiftHours(shift: string) {
  const [start, end] = shift.split(" - ");

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  let startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;

  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  return (endTotal - startTotal) / 60;
}

export function getShiftColor(shift: string) {
  const hours = calculateShiftHours(shift);

  if (hours === 4) {
    return "bg-blue-50 text-blue-700";
  }

  if (hours === 6) {
    return "bg-purple-50 text-purple-700";
  }

  if (hours === 8) {
    return "bg-green-50 text-green-700";
  }

  return "bg-gray-50 text-gray-700";
}