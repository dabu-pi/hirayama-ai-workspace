import { ProgramDetailScreen } from "@/components/programs/ProgramDetailScreen";
import { getProgramDetailView } from "@/lib/programs/program-detail";

export const dynamic = "force-dynamic";

type ProgramDetailPageProps = {
  params: {
    programSlug: string;
  };
};

export default async function ProgramDetailPage({
  params
}: ProgramDetailPageProps) {
  const { state, view, errorMessage } = await getProgramDetailView(
    params.programSlug
  );

  return (
    <ProgramDetailScreen
      errorMessage={errorMessage}
      state={state}
      view={view}
    />
  );
}
