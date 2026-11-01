"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import nl from "@fullcalendar/core/locales/nl";
import type { RecordData } from "@/lib/types";
export default function Calendar({
  records,
  tasks = false,
  onSelect,
  onAdd,
}: {
  records: RecordData[];
  tasks?: boolean;
  onSelect: (r: RecordData) => void;
  onAdd: () => void;
}) {
  return (
    <FullCalendar
      plugins={[
        dayGridPlugin,
        timeGridPlugin,
        listPlugin,
        interactionPlugin,
        luxonPlugin,
      ]}
      locale={nl}
      timeZone="Europe/Amsterdam"
      initialView="dayGridMonth"
      firstDay={1}
      height="auto"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
      }}
      events={records
        .filter((r) => (tasks ? r.due_date : true))
        .map((r) => ({
          id: r.id,
          title: r.title,
          start: tasks ? r.due_date! : r.starts_at,
          end: tasks ? undefined : r.ends_at,
          allDay: tasks,
          backgroundColor: "#77836c",
          borderColor: "#77836c",
        }))}
      eventClick={(e) => {
        const r = records.find((r) => r.id === e.event.id);
        if (r) onSelect(r);
      }}
      dateClick={onAdd}
      nowIndicator
    />
  );
}
