import Image from "next/image";
import clsx from "clsx";
import { Nunito } from "next/font/google";

const nunito = Nunito({ subsets: ["latin"], weight: "800" });

const SIZES = {
  sm: { mark: 32, text: "text-lg translate-y-[3px]" },
  lg: { mark: 96, text: "text-4xl" },
};

type LogoProps = {
  size?: keyof typeof SIZES;
  /** Extra classes for the wordmark, e.g. to hide it on small screens. */
  wordmarkClassName?: string;
  markTestId?: string;
  wordmarkTestId?: string;
};

export function Logo({
  size = "sm",
  wordmarkClassName,
  markTestId,
  wordmarkTestId,
}: LogoProps) {
  const { mark, text } = SIZES[size];
  return (
    <span
      className={clsx(
        "inline-flex items-center",
        size === "lg" ? "flex-col gap-2" : "gap-2",
      )}
    >
      <Image
        data-testid={markTestId}
        src="/logo-mark.svg"
        alt=""
        width={mark}
        height={mark}
        unoptimized
        priority
      />
      <span
        data-testid={wordmarkTestId}
        className={clsx(
          nunito.className,
          text,
          "tracking-tight text-brand-ink dark:text-foreground",
          wordmarkClassName,
        )}
      >
        House<span className="text-brand">Bud</span>
      </span>
    </span>
  );
}
