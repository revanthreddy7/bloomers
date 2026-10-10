insert into public.curricula(id,title) values ('00000000-0000-0000-0000-000000000001','Prototype Grade 8 Mathematics');
insert into public.courses(id,curriculum_id,title) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Grade 8 Mathematics');
insert into public.units(id,course_id,title,position) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Algebra',1);
insert into public.topics(id,unit_id,title,position) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','Linear Equations',1);
insert into public.skills(id,topic_id,code,title) values
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000004','integers','Integer arithmetic'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000004','fractions','Fraction arithmetic'),
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000004','inverse','Inverse operations'),
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000004','one-step','One-step equations'),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000004','two-step','Two-step equations');
insert into public.skill_prerequisites(skill_id,prerequisite_id) values
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000013'),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000014'),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000011'),
('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000012');
insert into public.course_skill_map(course_id,skill_id) select '00000000-0000-0000-0000-000000000002',id from public.skills where code in ('integers','fractions','inverse','one-step','two-step');

update public.skills set description = case code
 when 'integers' then 'Add, subtract, multiply, and divide signed integers.'
 when 'fractions' then 'Find common denominators and simplify fraction operations.'
 when 'inverse' then 'Identify inverse operations while preserving equality.'
 when 'one-step' then 'Solve and check equations with one inverse operation.'
 when 'two-step' then 'Solve and verify equations requiring two inverse operations.' end,
 difficulty = case when code = 'two-step' then 3 when code in ('fractions','one-step') then 2 else 1 end,
 estimated_minutes = case when code in ('fractions','two-step') then 30 else 20 end,
 assessment_rules = '{"independent_correct_required": 3, "allow_hints_for_mastery": false}'::jsonb
where code in ('integers','fractions','inverse','one-step','two-step');
insert into public.skill_prerequisites(skill_id, prerequisite_id) values
('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000011');
-- Questions are service-only: the browser must never read the answer column.
insert into public.questions(skill_id, prompt, answer) values
('00000000-0000-0000-0000-000000000011', 'Calculate -7 + 12.', '{"value":5}'),
('00000000-0000-0000-0000-000000000012', 'Calculate 1/2 + 1/4.', '{"numerator":3,"denominator":4}'),
('00000000-0000-0000-0000-000000000013', 'Which operation undoes adding 6?', '{"operation":"subtract","value":6}'),
('00000000-0000-0000-0000-000000000014', 'Solve x + 5 = 12.', '{"value":7}'),
('00000000-0000-0000-0000-000000000015', 'Solve 2x + 3 = 11.', '{"value":4}');
