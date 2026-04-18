export default function OfflinePage() {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center px-5">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-6xl">📡</div>
        <h1 className="font-display text-2xl font-bold text-stone-900">You&apos;re Offline</h1>
        <p className="text-stone-500 text-sm">
          No internet connection detected. Some content you&apos;ve already visited may still be available.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary w-full"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
