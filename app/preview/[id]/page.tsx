import { LearningContent } from '@/components/application/learning';
import { getLearningView } from '@/server/application/service';
export default async function PreviewHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LearningContent
      data={await getLearningView(id, 'preview')}
      view="overview"
      mode="preview"
    />
  );
}
