import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getSavedBranchId } from "@/lib/branch";
import { useNavigate, Link } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";
import { useBranch } from "@/hooks/useBranch";
import { useNearestBranch } from "@/hooks/useNearestBranch";
import { useDeliveryAddress } from "@/hooks/useDeliveryAddress";
import { getAddressIcon } from "@/lib/addressIcons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BranchSelectorDialog } from "@/components/BranchSelectorDialog";
import { DeliveryLocationSelector } from "@/components/DeliveryLocationSelector";
import { BranchInfoPill } from "@/components/BranchInfoPill";
import { CalendarCheck, Star, User, ArrowRight, ChevronDown, Package } from "lucide-react";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";
import { ActiveReservationBanner } from "@/components/ActiveReservationBanner";
import { SocialMediaSection } from "@/components/SocialMediaSection";
import { HeroBannerSlideshow } from "@/components/HeroBannerSlideshow";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import heroFood from "@/assets/hero-food.jpg";
import type { BannerItem } from "@/components/admin/HomePageViewSection";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { branch } = useBranch();
  const { deliveryAddress, handleLocationSelect, selectedType, addressLabel, isCurrentLocation } = useDeliveryAddress();
  const AddressIcon = getAddressIcon(addressLabel, isCurrentLocation);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [locationSelectorOpen, setLocationSelectorOpen] = useState(false);
  
  useNearestBranch();

  // Fetch branch-specific popular item IDs
  const currentBranchId = branch?.id || getSavedBranchId();
  const { data: branchPopularData } = useQuery({
    queryKey: ['popular-items-home-branch', currentBranchId],
    queryFn: async () => {
      if (!currentBranchId) return null;
      const { data, error } = await supabase
        .from('branch_popular_items')
        .select('popular_item_ids, section_title, section_description')
        .eq('branch_id', currentBranchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBranchId,
  });

  const popularItemIds = ((branchPopularData as any)?.popular_item_ids as string[]) || [];
  const { data: popularItems } = useQuery({
    queryKey: ['popular-items-home', popularItemIds],
    queryFn: async () => {
      if (popularItemIds.length === 0) return [];
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url, preparation_time_mins')
        .in('id', popularItemIds)
        .eq('is_available', true);
      if (error) throw error;
      // Preserve admin ordering
      const map = new Map((data || []).map(i => [i.id, i]));
      return popularItemIds.map(id => map.get(id)).filter(Boolean) as typeof data;
    },
    enabled: popularItemIds.length > 0,
  });

  const popularSectionTitle = (branchPopularData as any)?.section_title || 'Popular Items';
  const popularSectionDescription = (branchPopularData as any)?.section_description || 'Customer favorites';
  const currency = branding?.currency || 'USD';

  // Build banner data from branding settings
  const banners = useMemo<BannerItem[]>(() => {
    const bannerData = (branding?.banner_data as BannerItem[]) || [];
    if (bannerData.length > 0 && bannerData[0]?.image_url) {
      return bannerData;
    }
    return [{
      id: 'default',
      image_url: branding?.home_image_url || heroFood,
      focus_x: 50,
      focus_y: 50,
      title: branding?.hero_title || 'Fresh Asian flavors, delivered fast',
      description: branding?.hero_subtitle || 'Order now and get your meal in 30–40 minutes.',
    }];
  }, [branding]);

  const bannerStyle = branding?.banner_style || 'single';
  const slideshowInterval = branding?.slideshow_interval_seconds || 7;

  const quickActionsConfig = (branding as any)?.quick_actions_config as Record<string, boolean> | undefined;

  const allNavigationCards = [
    {
      key: "book_table",
      icon: CalendarCheck,
      title: t('home.bookTable'),
      description: t('home.reserveSpot'),
      path: "/book-table",
      color: "from-primary to-primary/90",
    },
    {
      key: "my_profile",
      icon: User,
      title: t('home.myProfile'),
      description: t('home.accountPreferences'),
      path: "/profile",
      color: "from-primary to-primary/90",
    },
  ];

  const navigationCards = allNavigationCards.filter(card => {
    if (!quickActionsConfig) return true;
    return quickActionsConfig[card.key] !== false;
  });

  const renderHeroContent = (currentBanner: BannerItem) => (
    <div className="h-full relative">
      {/* Zone 1: Title & Description — positioned at top of content area */}
      <div className="absolute inset-x-0 top-0 bottom-[140px] md:bottom-[130px] flex flex-col justify-start pt-8 md:pt-12 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
          <div className="max-w-md space-y-2">
            {branch?.name && (
              <p className="text-white/80 text-sm font-medium tracking-wide">
                {branch.name}
              </p>
            )}
            
            <h1 className="text-white text-4xl md:text-5xl font-bold leading-tight line-clamp-3">
              {currentBanner.title || 'Fresh Asian flavors, delivered fast'}
            </h1>
            
            <p className="text-white/90 text-lg leading-relaxed line-clamp-2">
              {currentBanner.description || 'Order now and get your meal in 30–40 minutes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Zone 2: Fixed selector buttons — absolutely anchored at bottom */}
      <div className="absolute inset-x-0 bottom-8 md:bottom-10">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
          <div className="max-w-md space-y-2">
            {/* Delivery Address Selector */}
            <div 
              onClick={() => setLocationSelectorOpen(true)}
              className="bg-card/95 backdrop-blur-sm rounded-2xl p-3 shadow-lg cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] active:opacity-90 border border-border/50"
            >
              <div className="flex items-center gap-2">
                <AddressIcon className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground flex-1 truncate">
                  {deliveryAddress}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Branch Info Pill */}
            <BranchInfoPill
              onClick={() => setBranchDialogOpen(true)}
              variant="hero"
              className="bg-card/95 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative w-full h-[45vh] min-h-[400px] overflow-hidden">
        {bannerStyle === 'slideshow' && banners.length > 1 ? (
          <HeroBannerSlideshow banners={banners} intervalSeconds={slideshowInterval}>
            {renderHeroContent}
          </HeroBannerSlideshow>
        ) : (
          <>
            <div className="absolute inset-0">
              <img 
                src={banners[0]?.image_url || heroFood} 
                alt="Hero banner" 
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${banners[0]?.focus_x ?? 50}% ${banners[0]?.focus_y ?? 50}%`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
            </div>
            <div className="relative h-full">
              {renderHeroContent(banners[0])}
            </div>
          </>
        )}
      </div>

      {/* Order Now Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="max-w-md">
          {branch?.is_paused ? (
            <div className="w-full h-14 flex items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive font-semibold text-sm mb-6">
              🚫 {t('home.branchBusy')}
            </div>
          ) : (
            <Button 
              size="lg" 
              onClick={() => navigate('/order')}
              className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all group mb-6 active:scale-[0.98]"
            >
              {branding?.cta_button_text || t('home.orderNow')}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-6 space-y-6">
        <ActiveOrderBanner />
        <ActiveReservationBanner />

        {/* Quick Actions */}
        {navigationCards.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {navigationCards.map((card) => (
              <Link key={card.path} to={card.path} className="no-underline group">
                <Card className="relative overflow-hidden bg-card border-border hover:border-primary/30 transition-all duration-200 hover:shadow-md active:scale-[0.97] active:opacity-90">
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
                  <div className="relative p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${card.color} shadow-sm`}>
                        <card.icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {card.title}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {card.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
        )}

        {/* Popular Items */}
        {popularItems && popularItems.length > 0 && (
          <div className="space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xl font-bold text-foreground">{popularSectionTitle}</h2>
                <p className="text-xs text-muted-foreground">{popularSectionDescription}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/order')} className="gap-1.5 h-8 text-xs">
                {t('home.viewAll')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {popularItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/order?item=${item.id}`)}
                  className="flex-shrink-0 w-[160px] cursor-pointer group snap-start"
                >
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-200 border-border active:scale-[0.96] active:opacity-90 shadow-md">
                    <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{item.name}</div>
                      )}
                      <Badge className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm text-foreground border-border shadow-sm">
                        {formatCurrency(item.price, currency)}
                      </Badge>
                      {item.preparation_time_mins && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent p-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{item.preparation_time_mins} min</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {item.name}
                      </h3>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Media Section */}
        <SocialMediaSection page="home" />

        <div className="text-center mt-8 pb-4">
          <p className="text-xs text-muted-foreground">
            {branding?.tenant_name || 'Sashiko'} © {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">All rights reserved</p>
        </div>
      </div>

      <BranchSelectorDialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen} />
      <DeliveryLocationSelector 
        open={locationSelectorOpen} 
        onOpenChange={setLocationSelectorOpen}
        onLocationSelect={handleLocationSelect}
        selectedType={selectedType}
      />
    </div>
  );
};

export default Index;
