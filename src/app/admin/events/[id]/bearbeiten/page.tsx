import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getClubs, getEventById } from "@/db/queries";
import { EditEventForm } from "./EditEventForm";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | undefined {
  const n = Number(id);
  return Number.isInteger(n) ? n : undefined;
}

export const metadata = { title: "Event bearbeiten" };

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const eventId = parseId(id);
  const [eventDetail, clubs] =
    eventId != null ? await Promise.all([getEventById(eventId), getClubs()]) : [undefined, []];
  if (!eventDetail) notFound();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Event bearbeiten"
        backHref="/admin/events"
      />
      <div className="px-[14px] py-4">
        <EditEventForm event={eventDetail} clubs={clubs} />
      </div>
    </div>
  );
}
