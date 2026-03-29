import { Sun, Eye, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/components/ThemeProvider";

const CYCLE: Theme[] = ["system", "light", "dark-grey", "dark"];

const NEXT_ICON: Record<Theme, React.ElementType> = {
  system:      Sun,
  light:       Eye,
  "dark-grey": Moon,
  dark:        Sun,
};

const NEXT_TITLE: Record<Theme, string> = {
  system:      "Switch to Light",
  light:       "Switch to Comfort Dark",
  "dark-grey": "Switch to True Dark",
  dark:        "Switch to System",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const Icon = NEXT_ICON[theme] ?? Eye;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      title={NEXT_TITLE[theme]}
      aria-label={NEXT_TITLE[theme]}
      className="h-9 w-9 rounded-xl transition-transform duration-150 active:scale-90"
    >
      <Icon className="h-[18px] w-[18px] text-muted-foreground transition-colors hover:text-foreground" />
    </Button>
  );
}

