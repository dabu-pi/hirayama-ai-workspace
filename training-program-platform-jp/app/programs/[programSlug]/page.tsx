import { ProgramDetailScreen } from "@/components/programs/ProgramDetailScreen";
import { getProgramDetailView } from "@/lib/programs/program-detail";
import { getActiveProgramView } from "@/lib/workout/active-program";

export const dynamic = "force-dynamic";

type ProgramDetailPageProps = {
  params: {
    programSlug: string;
  };
};

export default async function ProgramDetailPage({
  params
}: ProgramDetailPageProps) {
  const [{ state, view, errorMessage }, { views: enrollmentViews }] =
    await Promise.all([
      getProgramDetailView(params.programSlug),
      getActiveProgramView()
    ]);

  // Any active enrollment the user currently has (may be a different program)
  const anyActiveEnrollment =
    enrollmentViews.length > 0
      ? {
          title: enrollmentViews[0].programTitle,
          continueUrl: enrollmentViews[0].continueUrl,
          programSlug: enrollmentViews[0].programSlug
        }
      : null;

  return (
    <ProgramDetailScreen
      anyActiveEnrollment={anyActiveEnrollment}
      errorMessage={errorMessage}
      state={state}
      view={view}
    />
  );
}
