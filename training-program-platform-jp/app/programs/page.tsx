import { ProgramsScreen } from "@/components/programs/ProgramsScreen";
import { getProgramListView } from "@/lib/programs/program-list";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const { state, view, errorMessage } = await getProgramListView();

  return <ProgramsScreen errorMessage={errorMessage} state={state} view={view} />;
}
