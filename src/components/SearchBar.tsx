import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  onClear?: () => void;
  placeholder?: string;
  buttonLabel?: string;
  clearLabel?: string;
}

const SearchBar = ({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = "Search documents by title, keyword, or content...",
  buttonLabel = "Search",
  clearLabel = "Clear",
}: SearchBarProps) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.();
  };

  return (
    <form className="w-full max-w-2xl" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-12 h-13 text-base bg-card border-border rounded-lg font-body placeholder:text-muted-foreground focus-visible:ring-primary"
          />
        </div>
        <Button type="submit" className="h-13 px-5 font-body">
          {buttonLabel}
        </Button>
        {onClear && (
          <Button type="button" variant="outline" className="h-13 px-4 font-body" onClick={onClear}>
            {clearLabel}
          </Button>
        )}
      </div>
    </form>
  );
};

export default SearchBar;
