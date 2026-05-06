import { MousePointerClickIcon } from "lucide-react";
import { Badge } from "~/components/admin/ui/badge";
import { Button } from "~/components/admin/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/admin/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/admin/ui/popover";
import { Separator } from "~/components/admin/ui/separator";
import { Checkbox } from "~/components/common/checkbox";

interface Relation {
  id: string;
  name: string;
}

interface RelationSelectorProps {
  maxSelected?: number;
  onChange: (selectedIds: string[]) => void;
  relations: Relation[];
  selectedIds: string[];
}

export const RelationSelector = ({
  relations,
  selectedIds,
  onChange,
}: RelationSelectorProps) => {
  const selectedRelations = relations.filter((rel) =>
    selectedIds.includes(rel.id)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="w-full justify-start gap-2.5 px-3"
          prefix={<MousePointerClickIcon />}
          suffix={
            <Badge className="ml-auto size-auto px-1.5" variant="outline">
              {selectedRelations.length}
            </Badge>
          }
          variant="outline"
        >
          <Separator orientation="vertical" />

          <div className="relative flex flex-1 items-center gap-1 overflow-hidden">
            {selectedRelations.length === 0 && (
              <span className="font-normal text-muted-foreground">Select</span>
            )}

            {selectedRelations.map((relation) => (
              <Badge className="px-1.5" key={relation.id} variant="secondary">
                {relation.name}
              </Badge>
            ))}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {relations.map((alt) => {
                const isSelected = selectedIds.includes(alt.id);

                return (
                  <CommandItem
                    className="gap-2"
                    key={alt.id}
                    onSelect={() => {
                      const newSelected = isSelected
                        ? selectedIds.filter((id) => id !== alt.id)
                        : [...selectedIds, alt.id];
                      onChange(newSelected);
                    }}
                  >
                    <Checkbox checked={isSelected} />
                    <span>{alt.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          {selectedIds.length > 0 && (
            <div className="border-t p-1">
              <Button
                className="w-full"
                onClick={() => onChange([])}
                variant="ghost"
              >
                Clear selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
