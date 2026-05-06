export interface Option {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  withCount?: boolean;
}

export interface DataTableFilterField<TData> {
  label: string;
  options?: Option[];
  placeholder?: string;
  value: keyof TData;
}

export interface DataTableFilterOption<TData> {
  filterOperator?: string;
  filterValues?: string[];
  id: string;
  isMulti?: boolean;
  label: string;
  options: Option[];
  value: keyof TData;
}
