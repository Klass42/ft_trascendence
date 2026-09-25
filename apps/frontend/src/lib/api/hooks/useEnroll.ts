/** Self-enrolment by access code was removed. Admins enroll students. */
export function useEnroll() {
  return {
    enroll: async (_courseId: string, _accessCode?: string) => {
      throw new Error('La matrícula la hace el administrador del curso');
    },
    isLoading: false,
    error: null as Error | null,
  };
}
