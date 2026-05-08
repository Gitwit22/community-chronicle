import { Landmark } from "lucide-react";
import { BRANDING } from "@/lib/brandingConfig";

interface TimelineProps {
  isLoading?: boolean;
}

const Timeline = ({ isLoading = false }: TimelineProps) => {
  const timelineEvents = BRANDING.timelineEvents;

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="h-10 w-10 mx-auto mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-body">Loading timeline events...</p>
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-body">
          No timeline events yet. Events will appear here as documents are added.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-3xl font-bold text-foreground mb-2">
          Historical Timeline
        </h2>
        <p className="text-muted-foreground font-body max-w-2xl">
          Key milestones across Michigan Roundtable's history of interfaith bridge-building,
          racial equity, and community justice.
        </p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 flex gap-4 items-start">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
          <Landmark className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            Featured Legacy Moment
          </p>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">
            {BRANDING.featuredMoment.title}
          </h3>
          <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {BRANDING.featuredMoment.body}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl font-bold text-foreground mb-4">
          Roundtable Legacy
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BRANDING.legacyMilestones.map((milestone) => (
            <div
              key={milestone.year + milestone.title}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              <span className="font-body text-xs font-semibold text-primary uppercase tracking-wider">
                {milestone.year}
              </span>
              <h4 className="font-display text-base font-semibold text-foreground mt-1 mb-2">
                {milestone.title}
              </h4>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {milestone.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-8">
          {timelineEvents.map((event) => (
            <div key={event.year} className="relative flex items-start gap-6 group">
              <div className="relative z-10 flex-shrink-0 w-12 flex justify-center">
                <div className="w-3 h-3 rounded-full bg-primary border-2 border-card shadow-sm group-hover:scale-125 transition-transform" />
              </div>
              <div className="pb-2 -mt-1">
                <span className="text-sm font-body font-semibold text-primary">{event.year}</span>
                <h3 className="font-display text-lg font-semibold text-foreground mt-0.5">
                  {event.title}
                </h3>
                <p className="text-sm text-muted-foreground font-body mt-1 leading-relaxed max-w-lg">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
