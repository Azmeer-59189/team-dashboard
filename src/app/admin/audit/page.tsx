import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const ACTION_LABELS: Record<string, string> = {
  "department.create": "Created department",
  "department.delete": "Deleted department",
  "member.create": "Added member",
  "member.delete": "Removed member",
  "member.bulk_import": "Bulk imported members",
  "member.password_reset": "Reset member password",
};

export default async function AuditLogPage() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-gray-500">Who added or removed which department or member, most recent first.</p>
      </div>

      <div className="card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">When</th>
              <th className="py-2">Who</th>
              <th className="py-2">Action</th>
              <th className="py-2">Target</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-100">
                <td className="py-2 whitespace-nowrap">{log.createdAt.toLocaleString()}</td>
                <td className="py-2">{log.actorName}</td>
                <td className="py-2">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="py-2">{log.targetLabel}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500">
                  No activity logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
