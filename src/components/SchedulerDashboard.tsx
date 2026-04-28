import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarPlus,
  Check,
  Clock,
  Download,
  Edit,
  Trash2,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import CoverageSummary from "./CoverageSummary";
import { getShiftColor } from "../utils/getShiftColor";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SHIFT_BLOCKS = [
  "08:00 - 16:00",
  "10:00 - 18:00",
  "12:00 - 20:00",
  "14:00 - 22:00",
  "16:00 - 00:00",
] as const;

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

export type DayName = (typeof DAYS)[number];
export type ShiftBlock = (typeof SHIFT_BLOCKS)[number];

export type OvertimeEntry = {
  id: string;
  day: DayName;
  start: string;
  end: string;
  hours: number;
};

export type EmployeeSchedule = {
  id: number;
  name: string;
  days: Record<DayName, string>;
  hours: number;
  overtime: number;
  total: number;
  overtimeEntries: OvertimeEntry[];
};

function calculateHours(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  let startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;

  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  return (endTotal - startTotal) / 60;
}

function getShiftParts(shift: string) {
  const [start, end] = shift.split(" - ");
  return { start, end };
}

function getShiftStartHour(shift: string) {
  return Number(shift.split(" - ")[0].split(":")[0]);
}

function shiftCoversHour(shift: string, hour: number) {
  const startHour = getShiftStartHour(shift);
  const endHour = startHour + 8;

  return hour >= startHour && hour < endHour;
}

function getHourlyDemand(day: DayName, hour: number) {
  const isWeekend = day === "Sat" || day === "Sun";

  if (hour >= 8 && hour < 11) return 2;
  if (hour >= 11 && hour < 14) return 3;
  if (hour >= 14 && hour < 21) return isWeekend ? 5 : 4;
  if (hour >= 21 && hour < 24) return 3;

  return 0;
}

function shuffleArray<T>(array: T[]) {
  return [...array].sort(() => Math.random() - 0.5);
}

function createEmptyCoverage() {
  const coverage = {} as Record<DayName, Record<number, number>>;

  DAYS.forEach((day) => {
    coverage[day] = {};
    HOURS.forEach((hour) => {
      coverage[day][hour] = 0;
    });
  });

  return coverage;
}

function addShiftToCoverage(
  coverage: Record<DayName, Record<number, number>>,
  day: DayName,
  shift: string
) {
  HOURS.forEach((hour) => {
    if (shiftCoversHour(shift, hour)) {
      coverage[day][hour]++;
    }
  });
}

function getBestShiftForDay(
  day: DayName,
  coverage: Record<DayName, Record<number, number>>
) {
  return [...SHIFT_BLOCKS]
    .map((shift) => {
      let shortageScore = 0;
      let overstaffPenalty = 0;

      HOURS.forEach((hour) => {
        if (!shiftCoversHour(shift, hour)) return;

        const demand = getHourlyDemand(day, hour);
        const current = coverage[day][hour];

        if (current < demand) {
          shortageScore += demand - current;
        } else {
          overstaffPenalty += current - demand + 1;
        }
      });

      return {
        shift,
        score: shortageScore * 10 - overstaffPenalty,
      };
    })
    .sort((a, b) => b.score - a.score)[0].shift;
}

function hasShortage(
  coverage: Record<DayName, Record<number, number>>,
  day: DayName
) {
  return HOURS.some((hour) => coverage[day][hour] < getHourlyDemand(day, hour));
}

export default function SchedulerDashboard() {
  const [employees, setEmployees] = useState(12);
  const [schedule, setSchedule] = useState<EmployeeSchedule[]>([]);

  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeSchedule | null>(null);

  const [otDay, setOtDay] = useState<DayName>("Mon");
  const [otStart, setOtStart] = useState("16:00");
  const [otEnd, setOtEnd] = useState("20:00");

  const totalScheduledHours = useMemo(
    () => schedule.reduce((sum, emp) => sum + emp.hours, 0),
    [schedule]
  );

  const totalOvertimeHours = useMemo(
    () => schedule.reduce((sum, emp) => sum + emp.overtime, 0),
    [schedule]
  );

  const generateSchedule = () => {
    const safeEmployees = Math.max(employees, 1);
    const safeDaysOff = 2;
    const regularWorkDays = 5;
    const regularShiftHours = 8;

    const coverage = createEmptyCoverage();
    const offCountByDay = Array(7).fill(0);

    const newSchedule: EmployeeSchedule[] = Array.from(
      { length: safeEmployees },
      (_, index) => {
        const days = {} as Record<DayName, string>;

        DAYS.forEach((day) => {
          days[day] = "OFF";
        });

        return {
          id: index + 1,
          name: `TM ${index + 1}`,
          days,
          hours: 0,
          overtime: 0,
          total: 0,
          overtimeEntries: [],
        };
      }
    );

    shuffleArray(newSchedule).forEach((employee) => {
      const offDays = new Set<number>();

      while (offDays.size < safeDaysOff) {
        const minOffCount = Math.min(...offCountByDay);

        const bestDays = DAYS.map((_, index) => index).filter(
          (dayIndex) =>
            offCountByDay[dayIndex] === minOffCount && !offDays.has(dayIndex)
        );

        const selectedDay =
          bestDays[Math.floor(Math.random() * bestDays.length)];

        offDays.add(selectedDay);
        offCountByDay[selectedDay]++;
      }

      DAYS.forEach((day, dayIndex) => {
        if (offDays.has(dayIndex)) {
          employee.days[day] = "OFF";
          return;
        }

        const bestShift = getBestShiftForDay(day, coverage);

        employee.days[day] = bestShift;
        employee.hours += regularShiftHours;
        employee.total += regularShiftHours;

        addShiftToCoverage(coverage, day, bestShift);
      });

      if (employee.hours !== 40 && regularWorkDays * regularShiftHours === 40) {
        employee.hours = 40;
        employee.total = 40;
      }
    });

    DAYS.forEach((day) => {
      let safety = 0;

      while (hasShortage(coverage, day) && safety < 50) {
        safety++;

        const bestShift = getBestShiftForDay(day, coverage);
        const { start, end } = getShiftParts(bestShift);

        const overtimeEmployee = [...newSchedule]
  .filter((emp) => {
    const alreadyHasSameOT = emp.overtimeEntries.some(
      (entry) =>
        entry.day === day &&
        entry.start === start &&
        entry.end === end
    );

    return !alreadyHasSameOT;
  })
  .sort((a, b) => {
    const aIsOff = a.days[day] === "OFF" ? 0 : 1;
    const bIsOff = b.days[day] === "OFF" ? 0 : 1;

    return aIsOff - bIsOff || a.overtime - b.overtime;
  })[0];

if (!overtimeEmployee) break;

        const newEntry: OvertimeEntry = {
          id: crypto.randomUUID(),
          day,
          start,
          end,
          hours: 8,
        };

        overtimeEmployee.overtimeEntries.push(newEntry);
        overtimeEmployee.overtime += 8;
        overtimeEmployee.total += 8;

        addShiftToCoverage(coverage, day, bestShift);
      }
    });

    newSchedule.sort((a, b) => a.id - b.id);
    setSchedule(newSchedule);
  };

  const exportToExcel = () => {
    if (schedule.length === 0) return;

    const rows = schedule.map((emp) => {
      const row: Record<string, string | number> = {
        TM: emp.name,
      };

      DAYS.forEach((day) => {
        const dayOt = emp.overtimeEntries.filter((entry) => entry.day === day);

        const otText =
          dayOt.length > 0
            ? dayOt
                .map(
                  (entry) =>
                    `OT ${entry.start}-${entry.end} (${entry.hours}h)`
                )
                .join(" | ")
            : "";

        row[day] = otText ? `${emp.days[day]} | ${otText}` : emp.days[day];
      });

      row["Hrs"] = emp.hours;
      row["OT Hrs"] = emp.overtime;
      row["Total Hrs"] = emp.total;

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Schedule");
    XLSX.writeFile(workbook, "weekly-schedule.xlsx");
  };

  const openOvertimeModal = (employee: EmployeeSchedule) => {
    setSelectedEmployee(employee);
    setOtDay("Mon");
    setOtStart("16:00");
    setOtEnd("20:00");
  };

  const addOvertimeEntry = () => {
    if (!selectedEmployee) return;

    const hours = calculateHours(otStart, otEnd);
    if (hours <= 0) return;

    const newEntry: OvertimeEntry = {
      id: crypto.randomUUID(),
      day: otDay,
      start: otStart,
      end: otEnd,
      hours,
    };

    setSchedule((prev) =>
      prev.map((emp) => {
        if (emp.id !== selectedEmployee.id) return emp;

        const updatedEntries = [...emp.overtimeEntries, newEntry];
        const updatedOvertime = updatedEntries.reduce(
          (sum, entry) => sum + entry.hours,
          0
        );

        const updatedEmployee = {
          ...emp,
          overtimeEntries: updatedEntries,
          overtime: updatedOvertime,
          total: emp.hours + updatedOvertime,
        };

        setSelectedEmployee(updatedEmployee);
        return updatedEmployee;
      })
    );
  };

  const deleteOvertimeEntry = (entryId: string) => {
    if (!selectedEmployee) return;

    setSchedule((prev) =>
      prev.map((emp) => {
        if (emp.id !== selectedEmployee.id) return emp;

        const updatedEntries = emp.overtimeEntries.filter(
          (entry) => entry.id !== entryId
        );

        const updatedOvertime = updatedEntries.reduce(
          (sum, entry) => sum + entry.hours,
          0
        );

        const updatedEmployee = {
          ...emp,
          overtimeEntries: updatedEntries,
          overtime: updatedOvertime,
          total: emp.hours + updatedOvertime,
        };

        setSelectedEmployee(updatedEmployee);
        return updatedEmployee;
      })
    );
  };

  return (
    <div className="flex min-h-screen justify-center bg-[#f5f6f8]">
      <div className="w-full max-w-[1200px] p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Weekly Schedule
            </h1>
            <p className="text-sm text-gray-500">
              Every worker gets 40h/week, 2 days off, and shifts are matched to
              hourly demand.
            </p>
          </div>

          <button
            onClick={generateSchedule}
            className="flex items-center gap-2 rounded-md bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white"
          >
            <CalendarPlus size={16} />
            Generate Schedule
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            title="TOTAL EMPLOYEES"
            value={employees}
            icon={<Users size={18} />}
          />
          <StatCard
            title="SCHEDULED"
            value={schedule.length}
            icon={<Check size={18} />}
            green
          />
          <StatCard
            title="REGULAR HOURS"
            value={`${totalScheduledHours}h`}
            icon={<Clock size={18} />}
            blue
          />
          <StatCard
            title="OVERTIME HOURS"
            value={`${totalOvertimeHours}h`}
            icon={<Clock size={18} />}
          />
        </div>

        <div className="mb-6 rounded-md border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Schedule Parameters
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InputBox
                label="Employees"
                value={employees}
                onChange={setEmployees}
            />
            </div>

            <p className="mt-4 text-xs text-gray-400">
                Rules: • 40h/week • 2 days off • 5 working days • 8h shift blocks.
            </p>
        </div>

        {schedule.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-gray-200 bg-white">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <CalendarPlus size={26} />
              </div>
              <p className="text-sm font-medium text-gray-700">
                No schedule generated yet
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Click "Generate Schedule" to automatically assign shifts.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                Generated Schedule
              </p>

              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download size={14} />
                Export Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="text-xs uppercase text-gray-400">
                  <tr>
                    <th className="p-3 text-left">TM</th>
                    {DAYS.map((day) => (
                      <th key={day} className="p-3 text-left">
                        {day}
                      </th>
                    ))}
                    <th className="p-3 text-center">Hrs</th>
                    <th className="p-3 text-center">OT</th>
                    <th className="p-3 text-center">Total</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {schedule.map((emp) => (
                    <tr key={emp.id} className="border-t border-gray-100">
                      <td className="p-3 font-medium text-gray-900">
                        {emp.name}
                      </td>

                      {DAYS.map((day) => {
                        const dayOt = emp.overtimeEntries.filter(
                          (entry) => entry.day === day
                        );

                        return (
                          <td key={day} className="p-3 align-top">
                            {emp.days[day] === "OFF" ? (
                              <span className="text-xs font-semibold text-red-400">
                                OFF
                              </span>
                            ) : (
                                <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getShiftColor(
                                    emp.days[day]
                                    )}`}
                                >
                                    {emp.days[day]}
                                </span>
                            )}

                            {dayOt.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {dayOt.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="text-[11px] font-medium text-amber-600"
                                  >
                                    OT {entry.start}-{entry.end}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-3 text-center">{emp.hours}</td>
                      <td className="p-3 text-center text-amber-600">
                        {emp.overtime}
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {emp.total}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openOvertimeModal(emp)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Edit size={13} />
                          Edit OT
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <CoverageSummary schedule={schedule} />

        {selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Edit Overtime
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedEmployee.name}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                    Day
                  </label>
                  <select
                    value={otDay}
                    onChange={(e) => setOtDay(e.target.value as DayName)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  >
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                    Start
                  </label>
                  <input
                    type="time"
                    value={otStart}
                    onChange={(e) => setOtStart(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                    End
                  </label>
                  <input
                    type="time"
                    value={otEnd}
                    onChange={(e) => setOtEnd(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              </div>

              <button
                onClick={addOvertimeEntry}
                className="mb-5 w-full rounded-md bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white"
              >
                Add OT Period ({calculateHours(otStart, otEnd)}h)
              </button>

              <div className="mb-5 rounded-md bg-gray-50 p-4 text-sm">
                <div className="mb-3 flex justify-between font-semibold text-gray-900">
                  <span>Overtime Periods</span>
                  <span>{selectedEmployee.overtime}h OT</span>
                </div>

                {selectedEmployee.overtimeEntries.length === 0 ? (
                  <p className="text-sm text-gray-400">No overtime added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEmployee.overtimeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {entry.day} • {entry.start} - {entry.end}
                          </p>
                          <p className="text-xs text-gray-400">
                            {entry.hours} overtime hours
                          </p>
                        </div>

                        <button
                          onClick={() => deleteOvertimeEntry(entry.id)}
                          className="rounded-md p-1.5 text-red-400 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
                  <span>Total Hours</span>
                  <span>{selectedEmployee.total}h</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  green,
  blue,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  green?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-4">
      <div>
        <p className="text-xs font-semibold text-gray-400">{title}</p>
        <h3
          className={`mt-2 text-xl font-bold ${
            blue ? "text-blue-600" : green ? "text-green-600" : "text-gray-800"
          }`}
        >
          {value}
        </h3>
      </div>

      <div className="text-gray-400">{icon}</div>
    </div>
  );
}

function InputBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-400">{label}</label>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
      />
    </div>
  );
}