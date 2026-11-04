"use client";
import { CopyScope, useSiteContent } from "@/components/content-provider";

import FullCalendar from "@fullcalendar/react";
import { useState } from "react";
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
  const { text: copy } = useSiteContent();
  const [calendarMode, setCalendarMode] = useState("dayGridMonth");
  const months = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  const days = ["zo", "ma", "di", "wo", "do", "vr", "za"];

  return (
    <CopyScope>
      {
        <FullCalendar
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
            interactionPlugin,
            luxonPlugin,
          ]}
          locale={{
            ...nl,
            buttonText: {
              today: copy("vandaag"),
              month: copy("Maand"),
              week: copy("Week"),
              day: copy("Dag"),
              list: copy("Lijst"),
            },
            allDayText: copy("hele dag"),
            noEventsText: copy("Geen afspraken om weer te geven"),
            buttonHints: {
              prev: copy("Vorige"),
              next: copy("Volgende"),
              today: copy("Vandaag"),
            },
          }}
          datesSet={(range) => setCalendarMode(range.view.type)}
          titleFormat={(range) => {
            const label = (date: typeof range.start, withDay = false) =>
              `${withDay ? date.day + " " : ""}${copy(months[date.month])} ${date.year}`;
            if (calendarMode === "dayGridMonth" || calendarMode === "listMonth")
              return label(range.date);
            return range.end && range.end.day !== range.start.day
              ? `${label(range.start, true)} – ${label(range.end, true)}`
              : label(range.date, true);
          }}
          dayHeaderContent={(day) => (
            <>
              {copy(days[day.date.getUTCDay()])}
              {day.view.type !== "dayGridMonth"
                ? " " + day.date.getUTCDate()
                : ""}
            </>
          )}
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
              backgroundColor: "#66539d",
              borderColor: "#66539d",
            }))}
          eventClick={(e) => {
            const r = records.find((r) => r.id === e.event.id);
            if (r) onSelect(r);
          }}
          dateClick={onAdd}
          nowIndicator
        />
      }
    </CopyScope>
  );
}
