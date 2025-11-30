import { HeartFilledIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { LogoIcon } from "@/components/icons/logo-icon";
import { footerSocialLinks } from "@/sections/footer/_constants/footer";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full">
      <div className="w-full md:max-w-5xl mx-auto grid gap-8 px-4 py-8 md:p-8 md:grid-cols-[minmax(0,1fr)_auto] border-border/80 border-x border-dashed">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-center text-foreground">
              Made with ❤️ by
              <LogoIcon className="size-4" />
              <a href="https://littlegoat.com.br" target="_blank" rel="noreferrer">
                <p className="text-sm font-medium">Little Goat</p>
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {footerSocialLinks.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="group flex size-6 rounded items-center justify-center text-foreground/70 hover:text-foreground transition-[color,shadow] duration-100 ease-out-quad focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-ring-offset/50 focus-visible:outline-none"
              >
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3">
          <div className="flex flex-wrap gap-2">
            <a
              href="https://github.com/littlegoat-tech/removemark"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/20 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              <GitHubLogoIcon className="size-4" />
              GitHub
            </a>
            <a
              href="https://ko-fi.com/littlegoattech"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF5E5B]/10 hover:bg-[#FF5E5B]/20 border border-[#FF5E5B]/30 text-sm font-medium text-[#FF5E5B] transition-colors"
            >
              <HeartFilledIcon className="size-4" />
              Buy me a coffee
            </a>
          </div>
          <p className="text-xs text-foreground/50">Open source • Support this free tool</p>
        </div>
      </div>

      <div className="text-xs text-foreground/70 border-t border-border/80">
        <div className="w-full md:max-w-5xl mx-auto flex flex-col md:flex-row gap-1 px-4 py-4 md:px-2 items-center justify-between">
          <p>© {currentYear} Little Goat. All rights reserved.</p>
          <p>Software development and consulting.</p>
        </div>
      </div>
    </footer>
  );
}
