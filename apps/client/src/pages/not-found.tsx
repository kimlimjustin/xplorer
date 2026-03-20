const NotFound = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-xp-bg">
      <div className="w-full max-w-md mx-4 bg-xp-surface border border-xp-border rounded-lg p-6">
        <div className="flex mb-4 gap-2 items-center">
          <span className="text-2xl" role="img" aria-label="error">
            !
          </span>
          <h1 className="text-2xl font-bold text-xp-text">404 Page Not Found</h1>
        </div>

        <p className="mt-4 text-sm text-xp-text-secondary">
          Did you forget to add the page to the router?
        </p>
      </div>
    </div>
  );
}

export default NotFound;
