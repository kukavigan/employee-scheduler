export type EmployeeProfile = {
  id: number;
  name: string;
  maxWeeklyHours: number;
};

export default function EmployeeWeeklyHours({
  employeeProfiles,
  setEmployeeProfiles,
}: {
  employeeProfiles: EmployeeProfile[];
  setEmployeeProfiles: React.Dispatch<React.SetStateAction<EmployeeProfile[]>>;
}) {
  const updateMaxHours = (id: number, value: number) => {
    setEmployeeProfiles((prev) =>
      prev.map((employee) =>
        employee.id === id
          ? { ...employee, maxWeeklyHours: Math.max(0, value) }
          : employee
      )
    );
  };

  return (
    <div className="mt-6 rounded-md border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-700">
        Employee Weekly Hours
      </h2>

      <p className="mb-4 text-sm text-gray-500">
        Set the maximum weekly hours for each employee.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-center">Max Weekly Hours</th>
            </tr>
          </thead>

          <tbody>
            {employeeProfiles.map((employee) => (
              <tr key={employee.id} className="border-t border-gray-100">
                <td className="p-3 font-medium text-gray-800">
                  {employee.name}
                </td>

                <td className="p-3 text-center">
                  <input
                    type="number"
                    min={0}
                    value={employee.maxWeeklyHours}
                    onChange={(e) =>
                      updateMaxHours(employee.id, Number(e.target.value))
                    }
                    className="mx-auto w-24 rounded-md border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-gray-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}