import type { DayName } from "./SchedulerDashboard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default function ClosedDaysSelector({
  closedDays,
  setClosedDays,
}: {
  closedDays: DayName[];
  setClosedDays: React.Dispatch<React.SetStateAction<DayName[]>>;
}) {
  const toggleDay = (day: DayName) => {
    setClosedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="mb-6 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Closed / Blocked Days
      </h2>

      <p className="mb-4 text-sm text-gray-500">
        Select days when no employees should be scheduled.
      </p>

      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => {
          const isClosed = closedDays.includes(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                isClosed
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {day} {isClosed ? "Closed" : "Open"}
            </button>
          );
        })}
      </div>
    </div>
  );
}