export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            MerchOps
          </h1>
          <p className="text-sm text-muted-foreground">
            Calm operations for your Shopify store
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
