import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MapPin, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Support = () => {
  const navigate = useNavigate();
  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches-support"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, phone, address, city")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background pt-safe px-4 pb-8">
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted border border-border/50 shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
          aria-label="Go home"
        >
          <Home className="h-5 w-5" />
        </Button>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Contact Support</h1>
          <p className="text-muted-foreground text-sm">
            For any questions or issues, please contact any of our branches directly.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {branches?.map((branch) => (
              <Card key={branch.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{branch.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a
                    href={`tel:${branch.phone}`}
                    className="flex items-center gap-2 text-sm text-primary font-medium"
                  >
                    <Phone className="h-4 w-4" />
                    {branch.phone}
                  </a>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{branch.address}, {branch.city}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">
        Sashiko Asian Fusion © {new Date().getFullYear()}
        <br />
        All rights reserved
      </p>
    </div>
  );
};

export default Support;
