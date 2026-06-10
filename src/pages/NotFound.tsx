import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { EmptyState, EmptyAction } from "@/components/ui/empty-state";
import { SoftFlag } from "@/components/ui/EmptyIllustrations";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F5F1] px-4">
      <div className="max-w-md w-full">
        <EmptyState
          size="route"
          illustration={<SoftFlag />}
          title="Page not found"
          body="The page you're looking for doesn't exist or has moved."
          primary={
            <Link to="/" style={{ textDecoration: 'none' }}>
              <EmptyAction variant="primary">Go home</EmptyAction>
            </Link>
          }
        />
      </div>
    </div>
  );
};

export default NotFound;
