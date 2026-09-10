import { notFound } from 'next/navigation';
import {
  getComputer, listImages, listGenerations, listPublications, listStatusHistory, listExtractions, getSettings,
} from '@/lib/db';
import Workspace from '@/components/workspace/Workspace';

export const dynamic = 'force-dynamic';

export default function ComputerWorkspacePage({ params }: { params: { id: string } }) {
  const computer = getComputer(params.id);
  if (!computer) notFound();
  const settings = getSettings();

  return (
    <Workspace
      initial={{
        computer,
        images: listImages(computer.id),
        generations: listGenerations(computer.id),
        publications: listPublications(computer.id),
        statusHistory: listStatusHistory(computer.id),
        extractions: listExtractions(computer.id),
        settings,
      }}
    />
  );
}
