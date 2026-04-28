export function getShiftColor(shift: string) {
  if (shift === "08:00 - 16:00") {
    return "bg-blue-50 text-blue-700";
  }

  if (shift === "10:00 - 18:00") {
    return "bg-red-50 text-red-700";
  }

  if (shift === "12:00 - 20:00") {
    return "bg-purple-50 text-purple-700";
  }

  if (shift === "14:00 - 22:00") {
    return "bg-amber-50 text-amber-700";
  }

  if (shift === "16:00 - 00:00") {
    return "bg-green-50 text-green-700";
  }

  return "bg-gray-50 text-gray-700";
}