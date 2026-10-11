'use client';
import { useActionState, useState } from 'react';
import { enrollStudent } from '@/server/planning/actions';
import type { ActionState } from '@/features/identity/validation';
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export function EnrollmentForm({
  studentId,
  requestId,
  courses,
}: {
  studentId: string;
  requestId: string;
  courses: { id: string; name: string; version: number }[];
}) {
  const [state, action, pending] = useActionState(
    enrollStudent.bind(null, studentId),
    {} as ActionState,
  );
  const [fields, setFields] = useState({
    versionId: '',
    timezone: '',
    duration: '30',
    frequency: '2',
    time: '',
    earliestDate: '',
  });
  const [days, setDays] = useState<number[]>([]);
  const field =
    (key: keyof typeof fields) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields({ ...fields, [key]: event.target.value });
  return (
    <form action={action} className="identity-form">
      <input type="hidden" name="requestId" value={requestId} />
      <label>
        Published course
        <select
          name="versionId"
          value={fields.versionId}
          onChange={field('versionId')}
          required
        >
          <option value="">Choose a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} · Version {course.version}
            </option>
          ))}
        </select>
      </label>
      <label>
        Timezone
        <input
          name="timezone"
          list="timezones"
          value={fields.timezone}
          onChange={field('timezone')}
          placeholder="America/Los_Angeles"
          required
          maxLength={100}
        />
      </label>
      <datalist id="timezones">
        {[
          'America/Los_Angeles',
          'America/New_York',
          'America/Chicago',
          'Europe/London',
          'Europe/Berlin',
          'Asia/Kolkata',
          'Asia/Singapore',
          'Australia/Sydney',
          'UTC',
        ].map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <p className="field-help">
        Choose your timezone explicitly. Lesson times stay local when the UTC
        offset changes.
      </p>
      <label>
        Lesson duration (minutes)
        <input
          name="duration"
          type="number"
          min="20"
          max="90"
          value={fields.duration}
          onChange={field('duration')}
          required
        />
      </label>
      <label>
        Lessons per week
        <input
          name="frequency"
          type="number"
          min="1"
          max="7"
          value={fields.frequency}
          onChange={field('frequency')}
          required
        />
      </label>
      <fieldset>
        <legend>Preferred weekdays</legend>
        <div className="weekday-options">
          {weekdays.map((day, index) => (
            <label className="weekday-option" key={day}>
              <input
                name="weekdays"
                type="checkbox"
                value={index}
                checked={days.includes(index)}
                onChange={(event) =>
                  setDays(
                    event.target.checked
                      ? [...days, index]
                      : days.filter((d) => d !== index),
                  )
                }
              />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="field-help">
        Select exactly {fields.frequency || 'your chosen number of'} weekdays.
        One lesson is planned on each selected day.
      </p>
      <label>
        Preferred local lesson time
        <input
          name="time"
          type="time"
          value={fields.time}
          onChange={field('time')}
          required
        />
      </label>
      <label>
        Earliest starting date
        <input
          name="earliestDate"
          type="date"
          value={fields.earliestDate}
          onChange={field('earliestDate')}
          required
        />
      </label>
      <p className="field-help">
        Thirty minutes and two lessons/week are editable planning defaults. No
        weekday, time, date, or timezone is assumed. Ambiguous or nonexistent
        daylight-saving times must be changed.
      </p>
      {state.error && (
        <p role="alert" className="feedback error">
          {state.error}
        </p>
      )}
      <button disabled={pending || !courses.length}>
        {pending ? 'Creating roadmap…' : 'Confirm enrollment'}
      </button>
      <p className="field-help">
        Dates and completion are estimates. All skills start unassessed unless
        genuine evidence already exists. AI and media features remain inactive.
      </p>
    </form>
  );
}
