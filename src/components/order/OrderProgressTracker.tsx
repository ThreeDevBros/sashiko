import { CheckCircle2, Circle, Clock, ChefHat, Package, Truck, Home, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderProgressTrackerProps {
  status: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
}

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export function OrderProgressTracker({ status, orderType }: OrderProgressTrackerProps) {
  const deliverySteps: Step[] = [
    { id: 'pending', label: 'Order Placed', icon: <Clock className="h-5 w-5" />, description: 'Waiting for confirmation' },
    { id: 'confirmed', label: 'Confirmed', icon: <CheckCircle2 className="h-5 w-5" />, description: 'Restaurant accepted' },
    { id: 'preparing', label: 'Preparing', icon: <ChefHat className="h-5 w-5" />, description: 'Cooking your food' },
    { id: 'ready', label: 'Ready', icon: <Package className="h-5 w-5" />, description: 'Waiting for driver' },
    { id: 'out_for_delivery', label: 'On the Way', icon: <Truck className="h-5 w-5" />, description: 'Driver is delivering' },
    { id: 'delivered', label: 'Delivered', icon: <Home className="h-5 w-5" />, description: 'Enjoy your meal!' },
  ];

  const pickupSteps: Step[] = [
    { id: 'pending', label: 'Order Placed', icon: <Clock className="h-5 w-5" />, description: 'Waiting for confirmation' },
    { id: 'confirmed', label: 'Confirmed', icon: <CheckCircle2 className="h-5 w-5" />, description: 'Restaurant accepted' },
    { id: 'preparing', label: 'Preparing', icon: <ChefHat className="h-5 w-5" />, description: 'Cooking your food' },
    { id: 'ready', label: 'Ready for Pickup', icon: <Store className="h-5 w-5" />, description: 'Your order is ready to collect!' },
    { id: 'delivered', label: 'Picked Up', icon: <CheckCircle2 className="h-5 w-5" />, description: 'Enjoy your meal!' },
  ];

  const steps = orderType === 'pickup' || orderType === 'dine_in' ? pickupSteps : deliverySteps;

  const getStepStatus = (stepId: string): 'completed' | 'current' | 'upcoming' | 'cancelled' => {
    if (status === 'cancelled') return 'cancelled';
    
    const currentIndex = steps.findIndex(s => s.id === status);
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  if (status === 'cancelled') {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/20 mb-4">
          <Circle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-destructive mb-2">Order Cancelled</h3>
        <p className="text-muted-foreground text-sm">This order has been cancelled</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="font-semibold text-lg mb-6">Order Progress</h3>
      
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-[22px] top-[28px] bottom-[28px] w-0.5 bg-border" />
        
        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(step.id);
            
            return (
              <div key={step.id} className="relative flex items-start gap-4">
                {/* Icon Container */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-11 h-11 rounded-full border-2 transition-all duration-300",
                    stepStatus === 'completed' && "bg-primary border-primary text-primary-foreground",
                    stepStatus === 'current' && "bg-primary/20 border-primary text-primary",
                    stepStatus === 'upcoming' && "bg-muted border-border text-muted-foreground"
                  )}
                  style={stepStatus === 'current' ? {
                    animation: 'glow 2.5s ease-in-out infinite',
                  } : undefined}
                >
                  {step.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 pt-2">
                  <p
                    className={cn(
                      "font-medium transition-colors",
                      stepStatus === 'completed' && "text-foreground",
                      stepStatus === 'current' && "text-primary",
                      stepStatus === 'upcoming' && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      stepStatus === 'current' ? "text-primary/80" : "text-muted-foreground"
                    )}
                  >
                    {step.description}
                  </p>
                </div>
                
                {/* Status Badge */}
                {stepStatus === 'current' && (
                  <span className="absolute right-0 top-3 px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
