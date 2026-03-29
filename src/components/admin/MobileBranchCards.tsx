import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Pencil, Trash2, LayoutGrid, Clock, Phone, ChevronDown, Ruler, Star } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean | null;
  delivery_radius_km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: any;
}

interface MobileBranchCardsProps {
  branches: Branch[];
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onLayout: (branch: Branch) => void;
}

export const MobileBranchCards = ({ branches, onEdit, onDelete, onLayout }: MobileBranchCardsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!branches?.length) {
    return <p className="text-center text-muted-foreground py-8">No branches found.</p>;
  }

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-3 p-4">
      {branches.map((branch) => {
        const isExpanded = expandedId === branch.id;

        return (
          <div
            key={branch.id}
            className="rounded-lg border border-border/60 bg-card/50 overflow-hidden transition-all"
          >
            {/* Clickable summary area */}
            <div
              className="cursor-pointer active:bg-muted/30 transition-colors"
              onClick={() => toggle(branch.id)}
            >
              {/* A) Header Row */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-[15px]">{branch.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      branch.is_active
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              <div className="border-t border-border/30 mx-5" />

              {/* B) Address Block */}
              <div className="px-5 py-3">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Address</span>
                <p className="text-sm mt-1 leading-relaxed">{branch.address}, {branch.city}</p>
              </div>

              <div className="border-t border-border/30 mx-5" />

              {/* C) Contact + D) Hours */}
              <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-3">
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </span>
                  <p className="text-sm mt-1">{branch.phone || '—'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Hours
                  </span>
                  <p className="text-sm mt-1">
                    {branch.opens_at && branch.closes_at
                      ? `${branch.opens_at} – ${branch.closes_at}`
                      : '—'}
                  </p>
                </div>
                {branch.google_maps_rating && (
                  <div className="min-w-0">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Star className="w-3 h-3" /> Google Rating
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium">{branch.google_maps_rating}</span>
                      {branch.google_maps_review_count && (
                        <span className="text-xs text-muted-foreground">({branch.google_maps_review_count} reviews)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-border/40">
                <div className="px-5 py-3 space-y-3">
                  {/* Extra info */}
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Ruler className="w-3 h-3" /> Delivery Radius
                      </span>
                      <p className="text-sm mt-1">{branch.delivery_radius_km ? `${branch.delivery_radius_km} km` : '—'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Coordinates</span>
                      <p className="text-sm mt-1">
                        {branch.latitude && branch.longitude
                          ? `${branch.latitude.toFixed(4)}, ${branch.longitude.toFixed(4)}`
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border/30 mx-5" />

            {/* E) Actions Row — always visible */}
            <div className="px-5 py-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs px-3" onClick={() => onLayout(branch)}>
                <LayoutGrid className="w-4 h-4" />
                Layout
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs px-3" onClick={() => onEdit(branch)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-1.5 text-xs px-3 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => onDelete(branch)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
