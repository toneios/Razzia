import defaultLogo from "@razzia/web/assets/as-event-logo.png"
import { getBranding, imageFallback } from "@razzia/web/branding"
import GameBackground from "@razzia/web/components/GameBackground"
import GithubIcon from "@razzia/web/components/GithubIcon"
import type { PropsWithChildren } from "react"

const Background = ({ children }: PropsWithChildren) => {
  const branding = getBranding()
  const logo = branding?.logo ?? defaultLogo
  const appName = branding?.appName ?? "AS Event · Quiz Live"

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center">
      <GameBackground />
      <div className="as-event-entry relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logo}
            onError={imageFallback(defaultLogo)}
            className="as-event-logo mb-4 size-32 object-contain sm:size-40"
            alt={appName}
          />
          <h1 className="as-event-wordmark text-2xl font-bold tracking-widest text-white sm:text-3xl">
            {appName}
          </h1>
          <p className="mt-3 text-xs tracking-[0.3em] text-white/65">
            DJ • MUSIC • LIVE
          </p>
        </div>
        {children}
      </div>

      <a
        href="https://github.com/Ralex91/Razzia"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors hover:text-white/80"
      >
        <GithubIcon size={14} />
        {/* oxlint-disable-next-line no-undef */}
        Razzia - v{__APP_VERSION__}
      </a>
    </section>
  )
}

export default Background
