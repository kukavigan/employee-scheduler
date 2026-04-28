import type { EmployeeSchedule, DayName } from "./SchedulerDashboard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

type CoverageRequirements = Record<DayName, Record<number, number>>;

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

export default function CoverageSummary({
  coverageRequirements,
  setCoverageRequirements,
}: {
  schedule: EmployeeSchedule[];
  coverageRequirements: CoverageRequirements;
  setCoverageRequirements: React.Dispatch<
    React.SetStateAction<CoverageRequirements>
  >;
}) {
  const updateRequirement = (day: DayName, hour: number, value: number) => {
    setCoverageRequirements((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [hour]: Math.max(0, value),
      },
    }));
  };

  return (
    <div className="mt-6 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Hourly Coverage Requirements
      </h2>

      <p className="mb-4 text-sm text-gray-500">
        Enter how many employees are required for each hour and day. The schedule
        will generate based on these numbers.
      </p>

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
                    className="border border-gray-200 p-2 text-center"
                  >
                    <input
                      type="number"
                      min={0}
                      value={coverageRequirements[day][hour]}
                      onChange={(e) =>
                        updateRequirement(day, hour, Number(e.target.value))
                      }
                      className="mx-auto w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center font-semibold text-blue-700 outline-none focus:border-blue-500"
                    />
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