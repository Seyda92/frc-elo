import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getClubById } from "@/db/queries";
import { EditClubForm } from "./EditClubForm";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | undefined {
  const n = Number(id);
  return Number.isInteger(n) ? n : undefined;
}

export const metadata = { title: "Verein bearbeiten" };

export default async function EditClubPage({ params }: Props) {
  const { id } = await params;
  const clubId = parseId(id);
  const clubDetail = clubId != null ? await getClubById(clubId) : undefined;
  if (!clubDetail) notFound();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Verein bearbeiten"
        backHref="/admin/vereine"
      />
      <div className="px-[14px] py-4">
        <EditClubForm club={clubDetail} />
      </div>
    </div>
  );
}
