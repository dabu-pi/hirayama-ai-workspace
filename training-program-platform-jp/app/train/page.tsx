import { StartSessionScreen } from "@/components/workout/StartSessionScreen";
import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getTrainProgramSelection } from "@/lib/workout/train-selection";
import {
  findWorkoutSessionByDayId,
  getCurrentWorkoutSessionView
} from "@/lib/workout/train-session";

export const dynamic = "force-dynamic";

type TrainPageProps = {
  searchParams?: {
    program?: string | string[];
    programDayId?: string | string[];
  };
};

export default async function TrainPage({ searchParams }: TrainPageProps) {
  const selectedProgram = await getTrainProgramSelection(
    searchParams?.program,
    searchParams?.programDayId
  );

  // programDayId が渡されている場合: 既存セッションを探す
  // 既存セッションがなければ StartSessionScreen（開始確認画面）を表示する
  if (
    selectedProgram.state === "selected" &&
    selectedProgram.programDayId &&
    selectedProgram.programSlug &&
    selectedProgram.programTitle
  ) {
    const existingSession = await findWorkoutSessionByDayId(
      selectedProgram.programDayId
    );

    if (!existingSession) {
      // Week 1 / Day 1 開始確認画面
      return (
        <StartSessionScreen
          programDayId={selectedProgram.programDayId}
          programDayLabel="Week 1 / Day 1"
          programSlug={selectedProgram.programSlug}
          programTitle={selectedProgram.programTitle}
        />
      );
    }

    // 既存 in_progress セッションがあればそのまま WorkoutScreen へ
    return <WorkoutScreen selectedProgram={selectedProgram} session={existingSession} />;
  }

  // programDayId なし（クエリなし / invalid）: 従来どおり現在セッションを表示
  const session = await getCurrentWorkoutSessionView();
  return <WorkoutScreen selectedProgram={selectedProgram} session={session} />;
}
