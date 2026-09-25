import { Link } from "react-router-dom";
import { Button } from "../components/ui.js";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
