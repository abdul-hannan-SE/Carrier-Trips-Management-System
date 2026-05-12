export default function DashboardLoading() {
  // /dashboard redirects to /central-dashboard; show the central skeleton.
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="h-10 w-full bg-white border border-gray-200 rounded-lg animate-pulse mb-3" />
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-gray-100 border border-gray-200 rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
