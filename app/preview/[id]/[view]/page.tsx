import { notFound } from 'next/navigation';
import { LearningContent } from '@/components/application/learning';
import { getLearningView } from '@/server/application/service';
import { type LearningView } from '@/features/application/models';
export default async function PreviewView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; view: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id, view } = await params;
  if (!['course', 'homework', 'progress', 'schedule'].includes(view))
    notFound();
  const { week: raw } = await searchParams;
  const week =
    raw === undefined ? 0 : /^-?\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(week) || Math.abs(week) > 104) notFound();
  return (
    <LearningContent
      data={await getLearningView(id, 'preview', week)}
      view={view as LearningView}
      mode="preview"
      week={week}
    />
  );
}
