import clsx from "clsx";

// Full class names so Tailwind can find them.
const COLORS = [
  "bg-avatar-amber text-avatar-amber-ink",
  "bg-avatar-blue text-avatar-blue-ink",
  "bg-avatar-green text-avatar-green-ink",
  "bg-avatar-coral text-avatar-coral-ink",
];

const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-9 w-9 text-sm",
  md: "h-10 w-10 text-sm",
};

// The same user always gets the same color.
function colorFor(userId: string) {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

type AvatarProps = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

export function Avatar({
  userId,
  name,
  avatarUrl,
  size = "md",
  className,
}: AvatarProps) {
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        SIZES[size],
        !avatarUrl && colorFor(userId),
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        (name[0]?.toUpperCase() ?? "?")
      )}
    </div>
  );
}
