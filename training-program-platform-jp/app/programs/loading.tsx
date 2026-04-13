import { ProgramsScreen } from "@/components/programs/ProgramsScreen";

export default function ProgramsLoading() {
  return (
    <ProgramsScreen
      state="loading"
      view={{
        items: [],
        source: "mock_catalog"
      }}
    />
  );
}
