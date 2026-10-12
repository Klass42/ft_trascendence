/** Self-enrolment preview was removed with access codes. */
export function useCoursePreview(_courseId?: string, _enabled = false) {
  return { data: null, isLoading: false, error: null as Error | null };
}
