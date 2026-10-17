import defaultLogo from "@razzia/web/assets/as-event-logo.png"
import { useBranding, imageFallback } from "@razzia/web/branding"

const BrandSignature = () => {
  const branding = useBranding()

  return (
    <div className="flex items-center gap-3 text-white">
      <img
        src={branding.logo ?? defaultLogo}
        onError={imageFallback(defaultLogo)}
        alt={branding.appName ?? "AS Event"}
        className="size-12 shrink-0 object-contain"
      />
      <div>
        <p className="as-event-wordmark text-sm font-bold tracking-widest">
          {branding.appName ?? "AS Event"}
        </p>
        <p className="text-xs tracking-widest text-white/60">
          DJ • MUSIC • LIVE
        </p>
      </div>
    </div>
  )
}

export default BrandSignature
