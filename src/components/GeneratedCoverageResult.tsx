import type { EmployeeSchedule, DayName } from "./SchedulerDashboard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

function getShiftParts(shift: string) {
  const [start, end] = shift.split(" - ");
  return { start, end };
}

function shiftCoversHour(shift: string, hour: number) {
  const { start, end } = getShiftParts(shift);

  const startHour = Number(start.split(":")[0]);
  let endHour = Number(end.split(":")[0]);

  if (endHour <= startHour) {
    endHour += 24;
  }

  return hour >= startHour && hour < endHour;
}

function formatHourLabel(hour: number) {
  const nextHour = hour + 1;

  const format = (h: number) => {
    const normalized = h % 24;

    if (normalized === 0) return "12 AM";
    if (normalized < 12) return `${normalized} AM`;
    if (normalized === 12) return "12 PM";

    return `${normalized - 12} PM`;
  };

  return `${format(hour)} - ${format(nextHour)}`;
}

function buildGeneratedCoverage(schedule: EmployeeSchedule[]) {
  const coverage = {} as Record<DayName, Record<number, number>>;

  DAYS.forEach((day) => {
    coverage[day] = {} as Record<number, number>;

    HOURS.forEach((hour) => {
      coverage[day][hour] = 0;
    });
  });

  schedule.forEach((employee) => {
    DAYS.forEach((day) => {
      const shift = employee.days[day];

      if (shift !== "OFF") {
        HOURS.forEach((hour) => {
          if (shiftCoversHour(shift, hour)) {
            coverage[day][hour]++;
          }
        });
      }

      employee.overtimeEntries.forEach((entry) => {
        if (entry.day !== day) return;

        const otShift = `${entry.start} - ${entry.end}`;

        HOURS.forEach((hour) => {
          if (shiftCoversHour(otShift, hour)) {
            coverage[day][hour]++;
          }
        });
      });
    });
  });

  return coverage;
}

export default function GeneratedCoverageResult({
  schedule,
}: {
  schedule: EmployeeSchedule[];
}) {
  if (schedule.length === 0) return null;

  const coverage = buildGeneratedCoverage(schedule);

  return (
    <div className="mt-6 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Generated Coverage Result
      </h2>

      <p className="mb-4 text-sm text-gray-500">
        Shows how many employees the generated schedule assigned per hour.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#0f172a] text-white">
              <th className="border border-gray-200 p-2 text-left">
                Hour
              </th>

              {DAYS.map((day) => (
                <th
                  key={day}
                  className="border border-gray-200 p-2 text-center"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="border border-gray-200 bg-gray-50 p-2 font-semibold">
                  {formatHourLabel(hour)}
                </td>

                {DAYS.map((day) => (
                  <td
                    key={day}
                    className="border border-gray-200 p-2 text-center font-semibold text-blue-700"
                  >
                    {coverage[day][hour]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}