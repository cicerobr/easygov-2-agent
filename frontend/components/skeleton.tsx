export function SkeletonCard() {
    return (
        <div className="skeleton-card">
            <div className="flex items-start gap-4">
                <div className="skeleton skeleton-avatar" />
                <div className="flex-1">
                    <div className="skeleton skeleton-title" />
                    <div className="skeleton skeleton-text medium" />
                    <div className="skeleton skeleton-text short" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonStatCard() {
    return (
        <div className="skeleton-card" style={{ padding: "20px 24px" }}>
            <div className="skeleton skeleton-avatar mb-3" style={{ width: 40, height: 40 }} />
            <div className="skeleton" style={{ height: 32, width: "40%", marginBottom: 8 }} />
            <div className="skeleton skeleton-text short" />
        </div>
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <div className="skeleton" style={{ height: 28, width: 160, marginBottom: 8 }} />
                <div className="skeleton skeleton-text medium" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonStatCard key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="skeleton-card">
                    <div className="skeleton skeleton-title" />
                    <div className="space-y-3 mt-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
                        ))}
                    </div>
                </div>
                <div className="skeleton-card">
                    <div className="skeleton skeleton-title" />
                    <div className="space-y-3 mt-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
