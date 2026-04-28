import type { EmployeeSchedule, DayName } from "./SchedulerDashboard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

function getShiftStartHour(shift: string) {
  return Number(shift.split(" - ")[0].split(":")[0]);
}

function shiftCoversHour(shift: string, hour: number) {
  const startHour = getShiftStartHour(shift);
  const endHour = startHour + 8;

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

function buildCoverageSummary(schedule: EmployeeSchedule[]) {
  const summary = {} as Record<DayName, Record<number, number>>;

  DAYS.forEach((day) => {
    summary[day] = {};

    HOURS.forEach((hour) => {
      summary[day][hour] = 0;
    });
  });

  schedule.forEach((emp) => {
    DAYS.forEach((day) => {
      const shift = emp.days[day];

      if (shift !== "OFF") {
        HOURS.forEach((hour) => {
          if (shiftCoversHour(shift, hour)) {
            summary[day][hour]++;
          }
        });
      }

      emp.overtimeEntries.forEach((entry) => {
        if (entry.day !== day) return;

        const otShift = `${entry.start} - ${entry.end}`;

        HOURS.forEach((hour) => {
          if (shiftCoversHour(otShift, hour)) {
            summary[day][hour]++;
          }
        });
      });
    });
  });

  return summary;
}

export default function CoverageSummary({
  schedule,
}: {
  schedule: EmployeeSchedule[];
}) {
  const coverageSummary = buildCoverageSummary(schedule);

  if (schedule.length === 0) return null;

  return (
    <div className="mt-6 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">
        Hourly Coverage Summary
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#1f4e78] text-white">
              <th className="border border-gray-200 p-2 text-left">Hour</th>
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
              <tr key={hour} className="bg-[#fff2cc]">
                <td className="border border-gray-200 bg-white p-2 font-semibold">
                  {formatHourLabel(hour)}
                </td>

                {DAYS.map((day) => (
                  <td
                    key={day}
                    className="border border-gray-200 p-2 text-center font-semibold text-blue-700"
                  >
                    {coverageSummary[day][hour]}
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