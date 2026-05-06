import { Loader } from "lucide-react";

export default function LoadingPage() {
  return (
    <div className="grid h-dvh place-items-center">
      <Loader className="animate-spin" />
    </div>
  );
}
