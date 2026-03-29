import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MenuDisplay } from "@/components/MenuDisplay";
import { useBranch } from "@/hooks/useBranch";
import { useDeliveryAddress } from "@/hooks/useDeliveryAddress";
import { useNearestBranch } from "@/hooks/useNearestBranch";
import { BackButton } from "@/components/BackButton";
import { BottomNav } from "@/components/BottomNav";
import { useCart } from "@/contexts/CartContext";
import { BranchSelectorDialog } from "@/components/BranchSelectorDialog";
import { DeliveryLocationSelector } from "@/components/DeliveryLocationSelector";

import { BranchInfoPill } from "@/components/BranchInfoPill";
import { getAddressIcon } from "@/lib/addressIcons";

const Order = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branch, loading } = useBranch();
  const { deliveryAddress, handleLocationSelect, selectedType, addressLabel, isCurrentLocation } = useDeliveryAddress();
  const { itemCount } = useCart();
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [locationSelectorOpen, setLocationSelectorOpen] = useState(false);
  const AddressIcon = getAddressIcon(addressLabel, isCurrentLocation);

  useNearestBranch();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-background pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
          </div>
          <button
            onClick={() => setLocationSelectorOpen(true)}
            className="bg-muted/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 hover:bg-muted transition-colors"
          >
            <AddressIcon className="w-3 h-3" />
            <span className="max-w-[200px] truncate">{deliveryAddress || t('menu.setDeliveryAddress')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Branch Pill */}
        <BranchInfoPill
          onClick={() => setBranchDialogOpen(true)}
          variant="hero"
        />
      </header>

      {/* Busy Banner */}
      {branch?.is_paused && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
          <p className="text-destructive font-semibold text-sm">🚫 {t('menu.branchBusy')}</p>
          <p className="text-muted-foreground text-xs mt-1">{t('menu.tryLater')}</p>
        </div>
      )}

      {/* Menu Content */}
      {!branch && !loading ? (
        <div className="px-4">
          <Card className="p-12 text-center">
            <h3 className="text-2xl font-bold mb-4">{t('menu.noBranches')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('menu.noBranchesDesc')}
            </p>
            <Button onClick={() => navigate("/")}>{t('menu.returnHome')}</Button>
          </Card>
        </div>
      ) : (
        <MenuDisplay />
      )}

      {itemCount > 0 && <BottomNav />}

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

export default Order;
