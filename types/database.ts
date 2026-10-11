export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_runs: {
        Row: {
          created_at: string;
          id: string;
          lesson_id: string | null;
          metadata: NonNullable<Json>;
          model: string;
          operation: string;
          prompt_version: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          lesson_id?: string | null;
          metadata?: NonNullable<Json>;
          model: string;
          operation: string;
          prompt_version: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lesson_id?: string | null;
          metadata?: NonNullable<Json>;
          model?: string;
          operation?: string;
          prompt_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_runs_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      assessment_results: {
        Row: {
          attempt_id: string;
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          attempt_id: string;
          result: NonNullable<Json>;
        };
        Update: {
          attempt_id?: string;
          result?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'assessment_results_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: true;
            referencedRelation: 'student_attempts';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
        };
        Relationships: [];
      };
      availability_preferences: {
        Row: {
          id: string;
          preferences: NonNullable<Json>;
          student_course_id: string | null;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          preferences?: NonNullable<Json>;
          student_course_id?: string | null;
          student_id: string;
        };
        Update: {
          id?: string;
          preferences?: NonNullable<Json>;
          student_course_id?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_preferences_student_course_id_fkey';
            columns: ['student_course_id'];
            isOneToOne: true;
            referencedRelation: 'student_courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_preferences_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      consent_policies: {
        Row: {
          approved: boolean;
          consent_type: string;
          description: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          approved?: boolean;
          consent_type: string;
          description: string;
          version: string;
        };
        Update: {
          approved?: boolean;
          consent_type?: string;
          description?: string;
          version?: string;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          consent_type: string;
          event_order: number;
          granted: boolean;
          id: string;
          parent_id: string;
          policy_version: string;
          recorded_at: string;
          request_id: string | null;
          source: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          consent_type: string;
          event_order?: never;
          granted: boolean;
          id?: string;
          parent_id: string;
          policy_version?: string;
          recorded_at?: string;
          request_id?: string | null;
          source?: string;
          student_id: string;
        };
        Update: {
          consent_type?: string;
          event_order?: never;
          granted?: boolean;
          id?: string;
          parent_id?: string;
          policy_version?: string;
          recorded_at?: string;
          request_id?: string | null;
          source?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'consent_policy_fk';
            columns: ['consent_type', 'policy_version'];
            isOneToOne: false;
            referencedRelation: 'consent_policies';
            referencedColumns: ['consent_type', 'version'];
          },
          {
            foreignKeyName: 'consent_relationship_fk';
            columns: ['parent_id', 'student_id'];
            isOneToOne: false;
            referencedRelation: 'parent_student_relationships';
            referencedColumns: ['parent_id', 'student_id'];
          },
          {
            foreignKeyName: 'consents_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parent_profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'consents_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      course_plan_items: {
        Row: {
          course_plan_id: string;
          estimated_minutes: number | null;
          id: string;
          lesson_position: number | null;
          objectives: NonNullable<Json>;
          position: number;
          projected_date: string | null;
          skill_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_plan_id: string;
          estimated_minutes?: number | null;
          id?: string;
          lesson_position?: number | null;
          objectives?: NonNullable<Json>;
          position: number;
          projected_date?: string | null;
          skill_id: string;
        };
        Update: {
          course_plan_id?: string;
          estimated_minutes?: number | null;
          id?: string;
          lesson_position?: number | null;
          objectives?: NonNullable<Json>;
          position?: number;
          projected_date?: string | null;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'course_plan_items_course_plan_id_fkey';
            columns: ['course_plan_id'];
            isOneToOne: false;
            referencedRelation: 'course_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'course_plan_items_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_item_schedule_fk';
            columns: ['course_plan_id', 'lesson_position'];
            isOneToOne: false;
            referencedRelation: 'lesson_schedules';
            referencedColumns: ['course_plan_id', 'lesson_position'];
          },
        ];
      };
      course_plans: {
        Row: {
          algorithm_version: string | null;
          curriculum_version_id: string;
          id: string;
          status: string;
          student_course_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          algorithm_version?: string | null;
          curriculum_version_id: string;
          id?: string;
          status?: string;
          student_course_id: string;
          version?: number;
        };
        Update: {
          algorithm_version?: string | null;
          curriculum_version_id?: string;
          id?: string;
          status?: string;
          student_course_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'course_plans_curriculum_version_id_fkey';
            columns: ['curriculum_version_id'];
            isOneToOne: false;
            referencedRelation: 'curriculum_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'course_plans_student_course_id_fkey';
            columns: ['student_course_id'];
            isOneToOne: false;
            referencedRelation: 'student_courses';
            referencedColumns: ['id'];
          },
        ];
      };
      course_skill_map: {
        Row: {
          course_id: string;
          skill_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          skill_id: string;
        };
        Update: {
          course_id?: string;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'course_skill_map_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'course_skill_map_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      courses: {
        Row: {
          curriculum_id: string;
          id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          curriculum_id: string;
          id?: string;
          title: string;
        };
        Update: {
          curriculum_id?: string;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'courses_curriculum_id_fkey';
            columns: ['curriculum_id'];
            isOneToOne: false;
            referencedRelation: 'curricula';
            referencedColumns: ['id'];
          },
        ];
      };
      curricula: {
        Row: {
          id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          title: string;
        };
        Update: {
          id?: string;
          title?: string;
        };
        Relationships: [];
      };
      curriculum_versions: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          document: NonNullable<Json>;
          id: string;
          published_at: string | null;
          published_by: string | null;
          revision: number;
          status: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          document: NonNullable<Json>;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          revision?: number;
          status?: string;
          version: number;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          document?: NonNullable<Json>;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          revision?: number;
          status?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'curriculum_versions_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'curriculum_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'curriculum_versions_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      homework_assignments: {
        Row: {
          due_at: string | null;
          id: string;
          lesson_id: string | null;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          due_at?: string | null;
          id?: string;
          lesson_id?: string | null;
          student_id: string;
        };
        Update: {
          due_at?: string | null;
          id?: string;
          lesson_id?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'homework_assignments_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'homework_assignments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'homework_lesson_owner_fk';
            columns: ['lesson_id', 'student_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id', 'student_id'];
          },
        ];
      };
      homework_items: {
        Row: {
          assignment_id: string;
          id: string;
          question_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          id?: string;
          question_id: string;
        };
        Update: {
          assignment_id?: string;
          id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'homework_items_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'homework_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'homework_items_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
        ];
      };
      homework_results: {
        Row: {
          result: NonNullable<Json>;
          submission_id: string;
        };
        ComputedFields: never;
        Insert: {
          result: NonNullable<Json>;
          submission_id: string;
        };
        Update: {
          result?: NonNullable<Json>;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'homework_results_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: true;
            referencedRelation: 'homework_submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      homework_submissions: {
        Row: {
          assignment_id: string;
          id: string;
          submitted_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          id?: string;
          submitted_at?: string;
        };
        Update: {
          assignment_id?: string;
          id?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'homework_submissions_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'homework_assignments';
            referencedColumns: ['id'];
          },
        ];
      };
      learning_evidence: {
        Row: {
          created_at: string;
          evidence_type: string;
          id: string;
          payload: NonNullable<Json>;
          skill_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          evidence_type: string;
          id?: string;
          payload?: NonNullable<Json>;
          skill_id: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          evidence_type?: string;
          id?: string;
          payload?: NonNullable<Json>;
          skill_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'learning_evidence_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_evidence_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          lesson_id: string;
          payload: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          lesson_id: string;
          payload?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          lesson_id?: string;
          payload?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_events_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          lesson_id: string;
          sender: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          lesson_id: string;
          sender: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          sender?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_messages_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_outcomes: {
        Row: {
          lesson_id: string;
          outcomes: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          outcomes: NonNullable<Json>;
        };
        Update: {
          lesson_id?: string;
          outcomes?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_outcomes_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: true;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_plans: {
        Row: {
          lesson_id: string;
          plan: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          plan: NonNullable<Json>;
        };
        Update: {
          lesson_id?: string;
          plan?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_plans_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: true;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_schedules: {
        Row: {
          course_plan_id: string | null;
          ends_at: string;
          id: string;
          lesson_position: number | null;
          starts_at: string;
          status: string;
          student_id: string;
          timezone: string | null;
        };
        ComputedFields: never;
        Insert: {
          course_plan_id?: string | null;
          ends_at: string;
          id?: string;
          lesson_position?: number | null;
          starts_at: string;
          status?: string;
          student_id: string;
          timezone?: string | null;
        };
        Update: {
          course_plan_id?: string | null;
          ends_at?: string;
          id?: string;
          lesson_position?: number | null;
          starts_at?: string;
          status?: string;
          student_id?: string;
          timezone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_schedules_course_plan_id_fkey';
            columns: ['course_plan_id'];
            isOneToOne: false;
            referencedRelation: 'course_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_schedules_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lessons: {
        Row: {
          ended_at: string | null;
          id: string;
          schedule_id: string | null;
          started_at: string | null;
          status: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          ended_at?: string | null;
          id?: string;
          schedule_id?: string | null;
          started_at?: string | null;
          status?: string;
          student_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          schedule_id?: string | null;
          started_at?: string | null;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_schedule_owner_fk';
            columns: ['schedule_id', 'student_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_schedules';
            referencedColumns: ['id', 'student_id'];
          },
          {
            foreignKeyName: 'lessons_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lessons_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      parent_profiles: {
        Row: {
          display_name: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          display_name: string;
          role?: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          display_name?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_role_fk';
            columns: ['user_id', 'role'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id', 'role'];
          },
        ];
      };
      parent_reports: {
        Row: {
          created_at: string;
          id: string;
          report: NonNullable<Json>;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          report: NonNullable<Json>;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          report?: NonNullable<Json>;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_reports_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      parent_student_relationships: {
        Row: {
          parent_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          parent_id: string;
          student_id: string;
        };
        Update: {
          parent_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_student_relationships_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'parent_profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'parent_student_relationships_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          answer: NonNullable<Json>;
          id: string;
          prompt: string;
          skill_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer: NonNullable<Json>;
          id?: string;
          prompt: string;
          skill_id: string;
        };
        Update: {
          answer?: NonNullable<Json>;
          id?: string;
          prompt?: string;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      safety_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: NonNullable<Json>;
          student_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: NonNullable<Json>;
          student_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'safety_events_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      schedule_changes: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          new_state: NonNullable<Json>;
          previous_state: NonNullable<Json>;
          reason: string;
          student_id: string;
          trigger: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_state: NonNullable<Json>;
          previous_state: NonNullable<Json>;
          reason: string;
          student_id: string;
          trigger?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_state?: NonNullable<Json>;
          previous_state?: NonNullable<Json>;
          reason?: string;
          student_id?: string;
          trigger?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_changes_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_changes_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      session_summaries: {
        Row: {
          lesson_id: string;
          summary: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          summary: NonNullable<Json>;
        };
        Update: {
          lesson_id?: string;
          summary?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'session_summaries_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: true;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      skill_prerequisites: {
        Row: {
          prerequisite_id: string;
          skill_id: string;
        };
        ComputedFields: never;
        Insert: {
          prerequisite_id: string;
          skill_id: string;
        };
        Update: {
          prerequisite_id?: string;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'skill_prerequisites_prerequisite_id_fkey';
            columns: ['prerequisite_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'skill_prerequisites_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      skills: {
        Row: {
          assessment_rules: NonNullable<Json>;
          code: string;
          description: string;
          difficulty: number;
          estimated_minutes: number;
          id: string;
          mastery_threshold: number;
          title: string;
          topic_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_rules?: NonNullable<Json>;
          code: string;
          description?: string;
          difficulty?: number;
          estimated_minutes?: number;
          id?: string;
          mastery_threshold?: number;
          title: string;
          topic_id: string;
        };
        Update: {
          assessment_rules?: NonNullable<Json>;
          code?: string;
          description?: string;
          difficulty?: number;
          estimated_minutes?: number;
          id?: string;
          mastery_threshold?: number;
          title?: string;
          topic_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'skills_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      student_attempts: {
        Row: {
          created_at: string;
          id: string;
          question_id: string;
          response: NonNullable<Json>;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          question_id: string;
          response: NonNullable<Json>;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          question_id?: string;
          response?: NonNullable<Json>;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_attempts_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_attempts_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      student_courses: {
        Row: {
          course_id: string;
          creation_request_id: string | null;
          curriculum_version_id: string;
          enrolled_at: string;
          enrolled_by: string | null;
          id: string;
          initialization_state: string;
          status: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          creation_request_id?: string | null;
          curriculum_version_id: string;
          enrolled_at?: string;
          enrolled_by?: string | null;
          id?: string;
          initialization_state?: string;
          status?: string;
          student_id: string;
        };
        Update: {
          course_id?: string;
          creation_request_id?: string | null;
          curriculum_version_id?: string;
          enrolled_at?: string;
          enrolled_by?: string | null;
          id?: string;
          initialization_state?: string;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_course_version_fk';
            columns: ['curriculum_version_id', 'course_id'];
            isOneToOne: false;
            referencedRelation: 'curriculum_versions';
            referencedColumns: ['id', 'course_id'];
          },
          {
            foreignKeyName: 'student_courses_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_courses_enrolled_by_fkey';
            columns: ['enrolled_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_courses_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      student_memory_items: {
        Row: {
          category: string;
          content: NonNullable<Json>;
          id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          content: NonNullable<Json>;
          id?: string;
          student_id: string;
        };
        Update: {
          category?: string;
          content?: NonNullable<Json>;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_memory_items_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      student_misconceptions: {
        Row: {
          description: string;
          id: string;
          resolved_at: string | null;
          skill_id: string | null;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          id?: string;
          resolved_at?: string | null;
          skill_id?: string | null;
          student_id: string;
        };
        Update: {
          description?: string;
          id?: string;
          resolved_at?: string | null;
          skill_id?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_misconceptions_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_misconceptions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      student_profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          creation_request_id: string | null;
          display_name: string;
          grade: number | null;
          id: string;
          learning_goals: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          creation_request_id?: string | null;
          display_name: string;
          grade?: number | null;
          id?: string;
          learning_goals?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          creation_request_id?: string | null;
          display_name?: string;
          grade?: number | null;
          id?: string;
          learning_goals?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'student_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'parent_profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'student_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_role_fk';
            columns: ['user_id', 'role'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id', 'role'];
          },
        ];
      };
      student_skills: {
        Row: {
          assessment_state: string;
          confidence: number;
          evidence_count: number;
          last_evidence_id: string | null;
          last_practiced: string | null;
          mastery_score: number;
          next_review: string | null;
          skill_id: string;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_state?: string;
          confidence?: number;
          evidence_count?: number;
          last_evidence_id?: string | null;
          last_practiced?: string | null;
          mastery_score?: number;
          next_review?: string | null;
          skill_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assessment_state?: string;
          confidence?: number;
          evidence_count?: number;
          last_evidence_id?: string | null;
          last_practiced?: string | null;
          mastery_score?: number;
          next_review?: string | null;
          skill_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mastery_evidence_owner_fk';
            columns: ['last_evidence_id', 'student_id', 'skill_id'];
            isOneToOne: false;
            referencedRelation: 'learning_evidence';
            referencedColumns: ['id', 'student_id', 'skill_id'];
          },
          {
            foreignKeyName: 'student_skills_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_skills_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      student_uploads: {
        Row: {
          created_at: string;
          id: string;
          storage_path: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          storage_path: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          storage_path?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_uploads_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'student_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tool_calls: {
        Row: {
          ai_run_id: string;
          id: string;
          metadata: NonNullable<Json>;
          tool_name: string;
        };
        ComputedFields: never;
        Insert: {
          ai_run_id: string;
          id?: string;
          metadata?: NonNullable<Json>;
          tool_name: string;
        };
        Update: {
          ai_run_id?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          tool_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tool_calls_ai_run_id_fkey';
            columns: ['ai_run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      topics: {
        Row: {
          id: string;
          position: number;
          title: string;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          position: number;
          title: string;
          unit_id: string;
        };
        Update: {
          id?: string;
          position?: number;
          title?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'topics_unit_id_fkey';
            columns: ['unit_id'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
        ];
      };
      units: {
        Row: {
          course_id: string;
          id: string;
          position: number;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          id?: string;
          position: number;
          title: string;
        };
        Update: {
          course_id?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'units_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      active_preview_student: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      begin_student_preview: {
        Args: { p_student_id: string };
        Returns: string;
      };
      build_initial_course_plan: {
        Args: { d: Json; p_duration: number };
        Returns: Json;
      };
      build_initial_lesson_schedule: {
        Args: { p: Json; p_count: number; p_now: string };
        Returns: Json;
      };
      can_read_student: { Args: { p_student: string }; Returns: boolean };
      create_parent_student: {
        Args: {
          p_display_name: string;
          p_grade: number;
          p_learning_goals?: string;
          p_request_id: string;
        };
        Returns: string;
      };
      current_auth_session: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      curriculum_document_schema: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      end_student_preview: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      enroll_parent_student: {
        Args: {
          p_preferences: Json;
          p_request_id: string;
          p_student_id: string;
          p_version_id: string;
        };
        Returns: string;
      };
      initial_preferences_schema: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      is_academic_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_parent_of: { Args: { p_student: string }; Returns: boolean };
      limit_identity_mutations: { Args: { actor: string }; Returns: undefined };
      provision_parent: { Args: Record<PropertyKey, never>; Returns: string };
      publish_curriculum_version: {
        Args: { p_expected_revision: number; p_version_id: string };
        Returns: string;
      };
      published_academic_identity: {
        Args: { p_id: string; p_kind: string };
        Returns: boolean;
      };
      record_parent_consent: {
        Args: {
          p_consent_type: string;
          p_granted: boolean;
          p_policy_version: string;
          p_request_id: string;
          p_student_id: string;
        };
        Returns: string;
      };
      require_verified_parent: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      resolve_initial_local_time: {
        Args: { p_local: string; p_timezone: string };
        Returns: string;
      };
      save_curriculum_draft: {
        Args: {
          p_course_id: string;
          p_document?: Json;
          p_expected_revision?: number;
          p_version_id?: string;
        };
        Returns: string;
      };
      update_parent_student: {
        Args: {
          p_display_name: string;
          p_grade: number;
          p_learning_goals?: string;
          p_student_id: string;
        };
        Returns: undefined;
      };
      validate_curriculum_document: {
        Args: { d: Json; publishing?: boolean };
        Returns: undefined;
      };
      validate_initial_preferences: { Args: { p: Json }; Returns: Json };
    };
    Enums: {
      app_role: 'PARENT' | 'STUDENT' | 'ADMIN';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['PARENT', 'STUDENT', 'ADMIN'],
    },
  },
} as const;
