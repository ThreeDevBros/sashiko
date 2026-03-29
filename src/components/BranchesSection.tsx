import { useEffect, useState } from "react";
import { MapPin, Clock, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  opens_at: string;
  closes_at: string;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number | null;
}

export const BranchesSection = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { branch: selectedBranch } = useBranch();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (data) setBranches(data);
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, []);

  const handleBranchSelect = (branchId: string) => {
    setIsTransitioning(true);
    localStorage.setItem('selectedBranchId', branchId);
    
    // Small delay for visual feedback
    setTimeout(() => {
      // Trigger a custom event to notify other components
      window.dispatchEvent(new Event('branchChanged'));
      
      // Reset transition after event is dispatched
      setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 150);
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <Carousel className="w-full" opts={{ align: "start", loop: false }}>
        <CarouselContent className="-ml-2 md:-ml-4">
          {[1, 2, 3].map((i) => (
            <CarouselItem key={i} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
              <Card className="overflow-hidden">
                <div className="p-6 space-y-3">
                  <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="h-10 w-full bg-muted rounded-lg mt-4 animate-pulse" />
                </div>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="mb-6 max-w-md mx-auto px-5">
        <h2 className="text-lg font-semibold mb-3 text-foreground">Our Branches</h2>
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No branches available at the moment</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-foreground max-w-md mx-auto px-5">Our Branches</h2>
      <div className={`relative max-w-md mx-auto transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        <Carousel className="w-full px-5" opts={{ align: "start", loop: false, dragFree: true }}>
          <CarouselContent className="-ml-2">
            {branches.map((branch) => (
              <CarouselItem key={branch.id} className="pl-2 basis-[85%] md:basis-[70%]">
                <Card
                  onClick={() => handleBranchSelect(branch.id)}
                  className={`p-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    selectedBranch?.id === branch.id
                      ? 'border-primary border-2 bg-primary/5 shadow-lg'
                      : 'border-border hover:border-primary/50'
                  } ${isTransitioning && selectedBranch?.id === branch.id ? 'scale-95' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{branch.name}</h3>
                      {selectedBranch?.id === branch.id && (
                        <Badge variant="default" className="text-xs h-5 animate-scale-in">Selected</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                        <span className="line-clamp-1">{branch.address}, {branch.city}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 flex-shrink-0 text-primary" />
                        <span>
                          {formatTime(branch.opens_at)} - {formatTime(branch.closes_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-2 h-8 w-8" />
          <CarouselNext className="-right-2 h-8 w-8" />
        </Carousel>
      </div>
    </div>
  );
};
