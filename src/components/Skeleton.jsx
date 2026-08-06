function SkeletonBar({ className = "" }) {
  return <div className={`bg-gray-700/50 rounded animate-pulse ${className}`} />;
}

export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div className="bg-cardDark p-4 rounded overflow-x-auto">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBar key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-3 border-t border-gray-700">
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBar key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-cardDark p-5 rounded-xl">
          <SkeletonBar className="h-3 w-1/2 mb-3" />
          <SkeletonBar className="h-8 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonBar;