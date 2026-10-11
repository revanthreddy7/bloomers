import { notFound } from 'next/navigation';
import { getLearningView } from '@/server/application/service';
import { LearningContent } from '@/components/application/learning';
import {
  learningViews,
  type LearningView,
} from '@/features/application/models';
export default async function ParentLearningPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; view: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id, view } = await params;
  if (!learningViews.includes(view as LearningView)) notFound();
  const { week: raw } = await searchParams;
  const week =
    raw === undefined ? 0 : /^-?\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(week) || Math.abs(week) > 104) notFound();
  const data = await getLearningView(id, 'parent', week);
  return (
    <main>
      <LearningContent data={data} view={view as LearningView} week={week} />
    </main>
  );
}
