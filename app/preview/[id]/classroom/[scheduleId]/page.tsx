import { classroomContext, readClassroom } from '@/server/classroom/service';
import { Classroom } from '@/components/classroom/classroom';
export const dynamic = 'force-dynamic';
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string; scheduleId: string }>;
}) {
  const { id, scheduleId } = await params;
  const { context } = await classroomContext(id, scheduleId);
  const initial = await readClassroom(id, scheduleId, 0);
  return <Classroom context={context} initial={initial} />;
}
