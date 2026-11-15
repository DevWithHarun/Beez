import { Link } from "@tanstack/react-router";
import beezMark from "@/assets/beez-mark.png";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const big = size === "md";
  return (
    <Link to="/" aria-label="Beez home" className="flex items-center gap-1.5">
      <img
        src={beezMark}
        alt="Beez logo"
        width={512}
        height={512}
        className={big ? "h-9 w-9 object-contain sm:h-16 sm:w-16" : "h-9 w-9 object-contain sm:h-11 sm:w-11"}
      />
      <div>
        <div className={"font-semibold leading-none tracking-tight " + (big ? "text-[22px] sm:text-5xl" : "text-[22px] sm:text-3xl")}>
          B<span className="text-primary">eez</span>
        </div>
        <div className={"mt-0.5 font-bold tracking-[0.12em] " + (big ? "text-[5.5px] sm:mt-1 sm:text-[9px]" : "text-[5.5px] sm:text-[7px]")}>
          SMART TOOLS<span className="text-primary">.</span> REAL GROWTH<span className="text-primary">.</span>
        </div>
      </div>
    </Link>
  );
}
