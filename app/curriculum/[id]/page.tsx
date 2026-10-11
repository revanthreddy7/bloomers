import Link from 'next/link';
import { notFound } from 'next/navigation';
import { academicIdSchema } from '@/features/curriculum/schema';
import { getPublishedCourse } from '@/server/curriculum/service';
import { skills, relatedSkills } from '@/features/curriculum/engine';
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const { version } = await searchParams;
  if (
    !academicIdSchema.safeParse(id).success ||
    (version && !academicIdSchema.safeParse(version).success)
  )
    notFound();
  const course = await getPublishedCourse(id, version);
  if (!course) notFound();
  const names = new Map(
    skills(course.document).map((skill) => [skill.id, skill.name]),
  );
  return (
    <main className="account-content">
      <Link href="/curriculum">All published courses</Link>
      <h1>{course.document.name}</h1>
      <p>
        Grade {course.document.academicLevel} · {course.document.subject} ·
        Published version {course.version}
      </p>
      <p>{course.document.description}</p>
      <h2>Course objectives</h2>
      <TextList items={course.document.learningObjectives} />
      {course.units.map((unit) => (
        <section className="panel" key={unit.id}>
          <h2>
            {unit.position}. {unit.name}
          </h2>
          <p>{unit.description}</p>
          <TextList items={unit.learningObjectives} />
          {unit.topics.map((topic) => (
            <section key={topic.id}>
              <h3>
                {topic.position}. {topic.name}
              </h3>
              <p>{topic.description}</p>
              <h4>Teaching objectives</h4>
              <TextList items={topic.teachingObjectives} />
              <h4>Expected outcomes</h4>
              <TextList items={topic.expectedOutcomes} />
              <h4>Learning objectives</h4>
              <TextList items={topic.content.learningObjectives} />
              <h4>Key concepts</h4>
              <TextList items={topic.content.keyConcepts} />
              <h4>Explanation</h4>
              <TextList items={topic.content.explanations} />
              <h4>Worked examples</h4>
              {topic.content.workedExamples.map((example, index) => (
                <div key={index}>
                  <p>{example.problem}</p>
                  <TextList items={example.steps} />
                </div>
              ))}
              <h4>Common mistakes</h4>
              <TextList items={topic.content.commonMistakes} />
              <h4>Practice questions</h4>
              <TextList
                items={topic.content.practiceQuestions.map(
                  (question) => question.prompt,
                )}
              />
              <h4>Assessment objectives</h4>
              <TextList items={topic.content.assessmentObjectives} />
              <h4>Whiteboard demonstrations</h4>
              {topic.content.whiteboardPlans.map((plan, index) => (
                <div key={index}>
                  <p>{plan.title}</p>
                  <TextList items={plan.steps} />
                </div>
              ))}
              <h4>Teaching references</h4>
              <TextList
                items={topic.content.resourceReferences.map(
                  (resource) => `${resource.label}: ${resource.reference}`,
                )}
              />
              <h4>Skills and prerequisites</h4>
              <ol>
                {topic.skills.map((skill) => (
                  <li key={skill.id}>
                    <strong>{skill.name}</strong>
                    <p>{skill.description}</p>
                    <p>
                      Difficulty {skill.difficulty}/5 · {skill.estimatedMinutes}{' '}
                      minutes · Mastery threshold{' '}
                      {Math.round(skill.masteryThreshold * 100)}%
                    </p>
                    <p>
                      Independent correct responses required:{' '}
                      {skill.assessment.independentCorrectRequired}. Hints count
                      toward mastery:{' '}
                      {skill.assessment.allowHintsForMastery ? 'Yes' : 'No'}.
                    </p>
                    <p>
                      Prerequisites:{' '}
                      {relatedSkills(course.document, skill.id, 'prerequisites')
                        .map((id) => names.get(id))
                        .join(', ') || 'None'}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>
      ))}
    </main>
  );
}
function TextList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
