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
import * as XLSX from "xlsx-js-style";
import CoverageSummary from "./CoverageSummary";
import { getShiftColor } from "../utils/getShiftColor";
import EmployeeWeeklyHours, {
  type EmployeeProfile,
} from "./EmployeeWeeklyHours";
import ClosedDaysSelector from "./ClosedDaysSelector";
import CoverageMatchResult from "./CoverageMatchResult";
import { OVERTIME_BLOCKS } from "../utils/overtimeBlocks";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SHIFT_BLOCKS = [
  // 4h shifts
  "08:00 - 12:00",
  "09:00 - 13:00",
  "10:00 - 14:00",
  "11:00 - 15:00",
  "12:00 - 16:00",
  "13:00 - 17:00",
  "14:00 - 18:00",
  "15:00 - 19:00",
  "16:00 - 20:00",
  "17:00 - 21:00",
  "18:00 - 22:00",
  "19:00 - 23:00",
  "20:00 - 00:00",
  "21:00 - 01:00",
  "22:00 - 02:00",
  "23:00 - 03:00",

  // 6h shifts
  "08:00 - 14:00",
  "09:00 - 15:00",
  "10:00 - 16:00",
  "11:00 - 17:00",
  "12:00 - 18:00",
  "13:00 - 19:00",
  "14:00 - 20:00",
  "15:00 - 21:00",
  "16:00 - 22:00",
  "17:00 - 23:00",
  "18:00 - 00:00",
  "19:00 - 01:00",
  "20:00 - 02:00",
  "21:00 - 03:00",
  "22:00 - 04:00",
  "23:00 - 05:00",

  // 8h shifts
  "08:00 - 16:00",
  "09:00 - 17:00",
  "10:00 - 18:00",
  "11:00 - 19:00",
  "12:00 - 20:00",
  "13:00 - 21:00",
  "14:00 - 22:00",
  "15:00 - 23:00",
  "16:00 - 00:00",
  "17:00 - 01:00",
  "18:00 - 02:00",
  "19:00 - 03:00",
  "20:00 - 04:00",
  "21:00 - 05:00",
  "22:00 - 06:00",
  "23:00 - 07:00",
] as const;

const HOURS = Array.from({ length: 23 }, (_, i) => i + 8);

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
  maxWeeklyHours: number;
  days: Record<DayName, string>;
  hours: number;
  overtime: number;
  total: number;
  overtimeEntries: OvertimeEntry[];
};

type CoverageRequirements = Record<DayName, Record<number, number>>;

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

function getShiftHours(shift: string) {
  const { start, end } = getShiftParts(shift);
  return calculateHours(start, end);
}

function shiftCoversHour(shift: string, hour: number) {
  const { start, end } = getShiftParts(shift);

  const startHour = Number(start.split(":")[0]);
  let endHour = Number(end.split(":")[0]);

  if (endHour <= startHour) {
    endHour += 24;
  }

  const normalizedHour = hour < startHour ? hour + 24 : hour;

  return normalizedHour >= startHour && normalizedHour < endHour;
}

function createDefaultCoverageRequirements(): CoverageRequirements {
  const requirements = {} as CoverageRequirements;

  DAYS.forEach((day) => {
    requirements[day] = {} as Record<number, number>;

    HOURS.forEach((hour) => {
      if (hour >= 8 && hour < 12) requirements[day][hour] = 3;
      else if (hour >= 12 && hour < 14) requirements[day][hour] = 4;
      else if (hour >= 14 && hour < 20) requirements[day][hour] = 5;
      else if (hour >= 20 && hour < 22) requirements[day][hour] = 4;
      else requirements[day][hour] = 3;
    });
  });

  return requirements;
}

function getHourlyDemand(
  coverageRequirements: CoverageRequirements,
  day: DayName,
  hour: number
) {
  return coverageRequirements[day][hour] ?? 0;
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
  coverage: Record<DayName, Record<number, number>>,
  coverageRequirements: CoverageRequirements,
  remainingHours?: number
) {
  return [...SHIFT_BLOCKS]
    .filter((shift) => {
      if (remainingHours === undefined) return true;
      return getShiftHours(shift) <= remainingHours;
    })
    .map((shift) => {
      let shortageScore = 0;
      let overstaffPenalty = 0;
      let zeroDemandPenalty = 0;

      HOURS.forEach((hour) => {
        if (!shiftCoversHour(shift, hour)) return;

        const demand = getHourlyDemand(coverageRequirements, day, hour);
        const current = coverage[day][hour];

        if (demand === 0) {
          zeroDemandPenalty += 100;
          return;
        }

        if (current < demand) {
          shortageScore += demand - current;
        } else {
          overstaffPenalty += current - demand + 1;
        }
      });

      return {
        shift,
        score: shortageScore * 10 - overstaffPenalty - zeroDemandPenalty,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.shift;
}

function getBestOvertimeBlockForDay(
  day: DayName,
  coverage: Record<DayName, Record<number, number>>,
  coverageRequirements: CoverageRequirements
) {
  return [...OVERTIME_BLOCKS]
    .map((shift) => {
      let shortageScore = 0;
      let overstaffPenalty = 0;
      let zeroDemandPenalty = 0;

      HOURS.forEach((hour) => {
        if (!shiftCoversHour(shift, hour)) return;

        const demand = getHourlyDemand(coverageRequirements, day, hour);
        const current = coverage[day][hour];

        if (demand === 0) {
          zeroDemandPenalty += 100;
          return;
        }

        if (current < demand) {
          shortageScore += demand - current;
        } else {
          overstaffPenalty += current - demand + 1;
        }
      });

      return {
        shift,
        score: shortageScore * 10 - overstaffPenalty - zeroDemandPenalty,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.shift;
}


function hasShortage(
  coverage: Record<DayName, Record<number, number>>,
  coverageRequirements: CoverageRequirements,
  day: DayName
) {
  return HOURS.some(
    (hour) =>
      coverage[day][hour] < getHourlyDemand(coverageRequirements, day, hour)
  );
}

function isOvertimeConnectedToRegularShift(
  regularShift: string,
  overtimeStart: string,
  overtimeEnd: string
) {
  if (regularShift === "OFF") return false;

  const { start: regularStart, end: regularEnd } = getShiftParts(regularShift);

  return overtimeStart === regularEnd || overtimeEnd === regularStart;
}

export default function SchedulerDashboard() {
  const [employees, setEmployees] = useState(12);
  const [closedDays, setClosedDays] = useState<DayName[]>([]);

  const [employeeProfiles, setEmployeeProfiles] = useState<EmployeeProfile[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        name: `TM ${index + 1}`,
        maxWeeklyHours: 40,
      }))
  );

  const [schedule, setSchedule] = useState<EmployeeSchedule[]>([]);

  const [overtimeEnabled, setOvertimeEnabled] = useState(true);

  const [coverageRequirements, setCoverageRequirements] =
    useState<CoverageRequirements>(createDefaultCoverageRequirements);

  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeSchedule | null>(null);

  const [otDay, setOtDay] = useState<DayName>("Mon");
  const [otStart, setOtStart] = useState("16:00");
  const [otEnd, setOtEnd] = useState("20:00");

  const updateEmployeeCount = (value: number) => {
    const safeValue = Math.max(value, 1);

    setEmployees(safeValue);

    setEmployeeProfiles((prev) =>
      Array.from({ length: safeValue }, (_, index) => {
        const existing = prev[index];

        return (
          existing ?? {
            id: index + 1,
            name: `TM ${index + 1}`,
            maxWeeklyHours: 40,
          }
        );
      })
    );
  };

  const totalScheduledHours = useMemo(
    () => schedule.reduce((sum, emp) => sum + emp.hours, 0),
    [schedule]
  );

  const totalOvertimeHours = useMemo(
    () => schedule.reduce((sum, emp) => sum + emp.overtime, 0),
    [schedule]
  );

  const generateSchedule = () => {
    const coverage = createEmptyCoverage();
    const offCountByDay = Array(7).fill(0);

    const newSchedule: EmployeeSchedule[] = employeeProfiles.map((profile) => {
      const days = {} as Record<DayName, string>;

      DAYS.forEach((day) => {
        days[day] = "OFF";
      });

      return {
        id: profile.id,
        name: profile.name,
        maxWeeklyHours: profile.maxWeeklyHours,
        days,
        hours: 0,
        overtime: 0,
        total: 0,
        overtimeEntries: [],
      };
    });

    shuffleArray(newSchedule).forEach((employee) => {
      const targetWorkDays = Math.min(
        7,
        Math.ceil(employee.maxWeeklyHours / 8)
      );

      const safeDaysOff = 7 - targetWorkDays;
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
        if (closedDays.includes(day)) {
          employee.days[day] = "OFF";
          return;
        }

        if (offDays.has(dayIndex)) {
          employee.days[day] = "OFF";
          return;
        }

        const remainingHours = employee.maxWeeklyHours - employee.hours;

        if (remainingHours <= 0) {
          employee.days[day] = "OFF";
          return;
        }

        const bestShift = getBestShiftForDay(
          day,
          coverage,
          coverageRequirements,
          remainingHours
        );

        if (!bestShift) {
          employee.days[day] = "OFF";
          return;
        }

        const shiftHours = getShiftHours(bestShift);

        employee.days[day] = bestShift;
        employee.hours += shiftHours;
        employee.total += shiftHours;

        addShiftToCoverage(coverage, day, bestShift);
      });
    });

  if (overtimeEnabled) {
    DAYS.forEach((day) => {
      if (closedDays.includes(day)) return;

      let safety = 0;

      while (
        hasShortage(coverage, coverageRequirements, day) &&
        safety < 50
      ) {
        safety++;

        const bestShift = getBestOvertimeBlockForDay(
          day,
          coverage,
          coverageRequirements
        );

        if (!bestShift) break;

        const { start, end } = getShiftParts(bestShift);
        const otHours = getShiftHours(bestShift);

        const overtimeEmployee = [...newSchedule]

          .filter((emp) => {
          const alreadyHasSameOT = emp.overtimeEntries.some(
            (entry) =>
            entry.day === day &&
            entry.start === start &&
            entry.end === end
          );

          const alreadyHasAnyOTOnThisDay = emp.overtimeEntries.some(
          (entry) => entry.day === day
          );

          if (alreadyHasAnyOTOnThisDay) {
            return false;
          }

          const isWorkday = emp.days[day] !== "OFF";
          const isShortOvertime = otHours <= 4;
          const isLongOvertime = otHours >= 6;

          if (isShortOvertime) {
            const isConnectedToRegularShift = isOvertimeConnectedToRegularShift(
            emp.days[day],
            start,
            end
          );

          if (!isWorkday || !isConnectedToRegularShift) {
            return false;
            }
          }

          if (isLongOvertime && isWorkday) {
          return false;
          }

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
          hours: otHours,
        };

        overtimeEmployee.overtimeEntries.push(newEntry);
        overtimeEmployee.overtime += otHours;
        overtimeEmployee.total += otHours;

        addShiftToCoverage(coverage, day, bestShift);
      }
    });
  }

    newSchedule.sort((a, b) => a.id - b.id);
    setSchedule(newSchedule);
  };



  const exportToExcel = () => {
  if (schedule.length === 0) return;

  const workbook = XLSX.utils.book_new();

  const headerRow1 = ["TM"];
  const headerRow2 = [""];

  DAYS.forEach((day) => {
    headerRow1.push(day, "");
    headerRow2.push("Start", "End");
  });

  headerRow1.push("Hrs", "OT Hrs", "Total Hrs");
  headerRow2.push("", "", "");

  const rows = schedule.map((emp) => {
    const row: (string | number)[] = [emp.name];

    DAYS.forEach((day) => {
      const shift = emp.days[day];

      if (shift === "OFF") {
        row.push("OFF", "OFF");
      } else {
        const { start, end } = getShiftParts(shift);
        row.push(start, end);
      }
    });

    row.push(emp.hours, emp.overtime, emp.total);

    return row;
  });

  const data = [headerRow1, headerRow2, ...rows];

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet["!merges"] = [];

  let colIndex = 1;

  DAYS.forEach(() => {
    worksheet["!merges"]!.push({
      s: { r: 0, c: colIndex },
      e: { r: 0, c: colIndex + 1 },
    });

    colIndex += 2;
  });

  worksheet["!cols"] = [
    { wch: 16 },
    ...DAYS.flatMap(() => [{ wch: 12 }, { wch: 12 }]),
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  const borderStyle = {
    top: { style: "thin", color: { rgb: "D9E2EC" } },
    bottom: { style: "thin", color: { rgb: "D9E2EC" } },
    left: { style: "thin", color: { rgb: "D9E2EC" } },
    right: { style: "thin", color: { rgb: "D9E2EC" } },
  };

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });

      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "", t: "s" };
      }

      worksheet[cellAddress].s = {
        border: borderStyle,
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
        font: {
          name: "Arial",
          sz: 11,
        },
      };

      if (row === 0) {
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          fill: { fgColor: { rgb: "1F4E78" } },
          font: {
            name: "Arial",
            sz: 11,
            bold: true,
            color: { rgb: "FFFFFF" },
          },
        };
      }

      if (row === 1) {
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          fill: { fgColor: { rgb: "D9EAF7" } },
          font: {
            name: "Arial",
            sz: 10,
            bold: true,
            color: { rgb: "1F2937" },
          },
        };
      }

      if (col === 0 && row >= 2) {
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          alignment: {
            horizontal: "left",
            vertical: "center",
          },
          font: {
            name: "Arial",
            sz: 11,
            bold: true,
          },
        };
      }

      if (row >= 2) {
        const value = worksheet[cellAddress].v;

        if (value === "OFF") {
          worksheet[cellAddress].s = {
            ...worksheet[cellAddress].s,
            fill: { fgColor: { rgb: "FCE4E4" } },
            font: {
              name: "Arial",
              sz: 11,
              bold: true,
              color: { rgb: "B91C1C" },
            },
          };
        }
      }

      if (col >= range.e.c - 2 && row >= 2) {
        worksheet[cellAddress].s = {
          ...worksheet[cellAddress].s,
          fill: { fgColor: { rgb: "F8FAFC" } },
          font: {
            name: "Arial",
            sz: 11,
            bold: true,
          },
        };
      }
    }
  }

  worksheet["!freeze"] = {
    xSplit: 1,
    ySplit: 2,
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Schedule");
  XLSX.writeFile(workbook, "weekly-schedule.xlsx");
};




  const openOvertimeModal = (employee: EmployeeSchedule) => {
    setSelectedEmployee(employee);
    setOtDay(DAYS.find((day) => !closedDays.includes(day)) ?? "Mon");
    setOtStart("16:00");
    setOtEnd("20:00");
  };

  const addOvertimeEntry = () => {
    if (!selectedEmployee) return;

    const hours = calculateHours(otStart, otEnd);

      if (hours <= 0) return;

      if (!Number.isInteger(hours)) {
        alert("Overtime must be a full-hour value.");
      return;
    }

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
              Every worker follows their weekly hour limit, and shifts are
              matched to hourly demand.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setOvertimeEnabled((prev) => !prev)}
              className={`rounded-md px-4 py-3 text-sm font-semibold ${
              overtimeEnabled
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-500"
            }`}
            >
              Overtime: {overtimeEnabled ? "ON" : "OFF"}
            </button>

            <button
              onClick={generateSchedule}
              className="flex items-center gap-2 rounded-md bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white"
            >
            <CalendarPlus size={16} />
              Generate Schedule
            </button>
          </div>
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
              onChange={updateEmployeeCount}
            />
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Rules: • Custom weekly hours • 4h / 6h / 8h shift blocks • Overtime
            when coverage is still short.
          </p>
        </div>

        <ClosedDaysSelector
          closedDays={closedDays}
          setClosedDays={setClosedDays}
        />

        <EmployeeWeeklyHours
          employeeProfiles={employeeProfiles}
          setEmployeeProfiles={setEmployeeProfiles}
        />

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
                            {closedDays.includes(day) ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                              HOLIDAY
                            </span>
                          ) : emp.days[day] === "OFF" ? (
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

        <CoverageMatchResult
          schedule={schedule}
          coverageRequirements={coverageRequirements}
        />

        <CoverageSummary
          schedule={schedule}
          coverageRequirements={coverageRequirements}
          setCoverageRequirements={setCoverageRequirements}
        />
        

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
                    {DAYS.filter((day) => !closedDays.includes(day)).map((day) => (
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
                  <p className="text-sm text-gray-400">
                    No overtime added yet.
                  </p>
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