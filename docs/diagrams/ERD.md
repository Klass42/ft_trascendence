# ERD — Course, Subject, membership, staff

`Course` is a cohort (name + academic year). `Subject` is the old teaching container, renamed, and it belongs to exactly one course. The fuller diagram is in [`docs/diagrams.md`](../diagrams.md).

```mermaid
erDiagram
  Organization ||--o{ Course : has
  Organization ||--o{ Subject : has
  Course ||--o{ Subject : contains
  Course ||--o{ CourseMembership : enrolls
  User ||--o{ CourseMembership : student
  Subject ||--o{ SubjectStaff : staffed
  User ||--o{ SubjectStaff : "teacher or assistant"
  Subject ||--o{ Section : has
  Subject ||--o{ Activity : has
  Subject ||--o{ Assignment : has
  Subject ||--o{ ForumThread : has
  Subject ||--o{ SubjectResource : publishes
```

There is no `Enrollment`, `ownerId`, `accessCode`, or `CourseRole`. Progress is computed from `LessonCompletion`.
