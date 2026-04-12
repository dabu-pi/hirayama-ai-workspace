import { ProgramDetailScreen } from "@/components/programs/ProgramDetailScreen";

export default function ProgramDetailLoading() {
  return (
    <ProgramDetailScreen
      state="loading"
      view={{
        program: null,
        source: "mock_catalog",
        firstProgramDayId: null,
        startProgramDayId: null,
        hasActiveEnrollment: false
      }}
    />
  );
}
