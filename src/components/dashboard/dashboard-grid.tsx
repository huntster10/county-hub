"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, Check, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WidgetFrame } from "./widget-frame";
import { ErlcStatusProvider } from "@/lib/hooks/use-erlc-status";
import { saveDashboardLayout } from "@/server/actions/profile";
import { isAdmin, isStaff } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { DashboardLayout, Profile, Shift } from "@/lib/types/database";
import type { DashboardData } from "@/lib/data/dashboard";

import { ServerStatusWidget } from "./widgets/server-status";
import { QuickActionsWidget } from "./widgets/quick-actions";
import { OnlineStaffWidget } from "./widgets/online-staff";
import { ActivityChartWidget } from "./widgets/activity-chart";
import { DepartmentChartWidget } from "./widgets/department-chart";
import { MyStatsWidget } from "./widgets/my-stats";
import { RecentPunishmentsWidget } from "./widgets/recent-punishments";
import { LiveEventsWidget } from "./widgets/live-events";
import { RecentMessagesWidget } from "./widgets/recent-messages";
import { SessionsWidget } from "./widgets/sessions";

/** Column span on the 12-column grid at xl screens. */
type Span = 3 | 4 | 6 | 8 | 12;

interface WidgetDef {
  id: string;
  title: string;
  description?: string;
  span: Span;
  staffOnly?: boolean;
  render: () => React.ReactNode;
}

const SPAN_CLASS: Record<Span, string> = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  6: "xl:col-span-6",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};

const STORAGE_KEY = "erlc-hub:dashboard-layout";

export function DashboardGrid({
  profile,
  data,
  activeShift,
}: {
  profile: Profile;
  data: DashboardData;
  activeShift: Shift | null;
}) {
  const staff = isStaff(profile.role);

  // Every widget the dashboard knows about. Order here = default order.
  const widgets: WidgetDef[] = useMemo(
    () => [
      { id: "server-status", title: "Live server", description: "Straight from the ER:LC API", span: 6, render: () => <ServerStatusWidget canConfigure={isAdmin(profile.role)} /> },
      { id: "quick-actions", title: "Quick actions", span: 6, render: () => <QuickActionsWidget role={profile.role} hasActiveShift={Boolean(activeShift)} /> },
      { id: "activity-chart", title: "Staff activity", description: "Hours on duty per day", span: 8, render: () => <ActivityChartWidget data={data.activityByDay} /> },
      { id: "my-stats", title: "My week", span: 4, render: () => <MyStatsWidget minutesWeek={data.stats.myMinutesWeek} quota={data.stats.weeklyQuota} /> },
      { id: "online-staff", title: "On duty now", span: 4, render: () => <OnlineStaffWidget rows={data.onlineStaff} /> },
      { id: "department-chart", title: "Department performance", description: "Hours on duty this week", span: 8, render: () => <DepartmentChartWidget data={data.departmentActivity} /> },
      { id: "live-events", title: "Live game events", description: "Joins, kills, commands, mod calls", span: 6, staffOnly: true, render: () => <LiveEventsWidget /> },
      { id: "recent-punishments", title: "Recent punishments", span: 6, staffOnly: true, render: () => <RecentPunishmentsWidget rows={data.recentPunishments} /> },
      { id: "recent-messages", title: "Latest messages", span: 6, render: () => <RecentMessagesWidget rows={data.recentMessages} /> },
      { id: "sessions", title: "Sessions", span: 6, render: () => <SessionsWidget sessions={data.sessions} canManage={staff} /> },
    ],
    [profile.role, activeShift, data, staff],
  );

  const available = widgets.filter((w) => !w.staffOnly || staff);
  const defaultOrder = available.map((w) => w.id);

  const [layout, setLayout] = useState<DashboardLayout>(() => normalise(profile.dashboard_layout, defaultOrder));
  const [customizing, setCustomizing] = useState(false);
  const [, startTransition] = useTransition();

  // Fall back to localStorage if the profile has no saved layout yet.
  useEffect(() => {
    if (profile.dashboard_layout) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // localStorage only exists in the browser, so this has to live in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLayout(normalise(JSON.parse(raw), defaultOrder));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: DashboardLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    startTransition(async () => {
      const r = await saveDashboardLayout(next);
      if (!r.ok) toast.error("Couldn't save layout: " + r.error);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = layout.order.indexOf(String(active.id));
    const to = layout.order.indexOf(String(over.id));
    persist({ ...layout, order: arrayMove(layout.order, from, to) });
  };

  const toggleHidden = (id: string) => {
    const hidden = layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id];
    persist({ ...layout, hidden });
  };

  const visible = layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => available.find((w) => w.id === id)!).filter(Boolean);

  return (
    <ErlcStatusProvider>
      <div className="mb-4 flex items-center justify-end gap-2">
        {customizing && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Eye className="size-3.5" /> Show / hide</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Widgets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {available.map((w) => (
                  <DropdownMenuCheckboxItem key={w.id} checked={!layout.hidden.includes(w.id)} onCheckedChange={() => toggleHidden(w.id)}>
                    {w.title}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" onClick={() => persist({ order: defaultOrder, hidden: [] })}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          </>
        )}
        <Button variant={customizing ? "default" : "outline"} size="sm" onClick={() => setCustomizing((c) => !c)}>
          {customizing ? <><Check className="size-3.5" /> Done</> : <><LayoutGrid className="size-3.5" /> Customize</>}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
            {visible.map((w) => (
              <SortableWidget key={w.id} widget={w} customizing={customizing} onHide={() => toggleHidden(w.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visible.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Every widget is hidden. Use “Show / hide” to bring some back.</p>
      )}
    </ErlcStatusProvider>
  );
}

function SortableWidget({ widget, customizing, onHide }: { widget: WidgetDef; customizing: boolean; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !customizing });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("min-h-[220px]", widget.span >= 8 ? "md:col-span-2" : "md:col-span-1", SPAN_CLASS[widget.span], isDragging && "z-10 opacity-80")}
    >
      <WidgetFrame
        title={widget.title}
        description={widget.description}
        customizing={customizing}
        onHide={onHide}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      >
        {widget.render()}
      </WidgetFrame>
    </div>
  );
}

/** Make sure a saved layout still matches the widgets that exist today. */
function normalise(saved: DashboardLayout | null | undefined, defaults: string[]): DashboardLayout {
  if (!saved || !Array.isArray(saved.order)) return { order: defaults, hidden: [] };
  const known = new Set(defaults);
  const order = saved.order.filter((id) => known.has(id));
  for (const id of defaults) if (!order.includes(id)) order.push(id);
  const hidden = (saved.hidden ?? []).filter((id) => known.has(id));
  return { order, hidden };
}
