import { ProgramsScreen } from "@/components/programs/ProgramsScreen";
import { getProgramListView } from "@/lib/programs/program-list";
import { getActiveProgramView } from "@/lib/workout/active-program";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const [{ state, view, errorMessage }, { views: enrollmentViews }] =
    await Promise.all([getProgramListView(), getActiveProgramView()]);

  const activeEnrollment =
    enrollmentViews.length > 0
      ? {
          title: enrollmentViews[0].programTitle,
          continueUrl: enrollmentViews[0].continueUrl
        }
      : null;

  return (
    <ProgramsScreen
      activeEnrollment={activeEnrollment}
      errorMessage={errorMessage}
      state={state}
      view={view}
    />
  );
}
