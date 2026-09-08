import Image from "next/image";

const logoAsset = "spendwise-butterfly-logo-icon-transparent.png";

export function spendwiseLogoSrc(basePath: string) {
  return `${basePath.replace(/\/$/, "")}/${logoAsset}`;
}

export function SpendwiseLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`spendwise-logo${compact ? " spendwise-logo--compact" : ""}`} aria-label="Budget Trip">
      <Image className="spendwise-logo__image" src={spendwiseLogoSrc(process.env.NEXT_PUBLIC_BASE_PATH ?? "")} alt="Budget Trip logo" width={110} height={110} sizes="24px" priority />
      <span className="spendwise-logo__type">
        <span className="spendwise-logo__name">Budget</span>
        <span className="spendwise-logo__trip">TRIP</span>
      </span>
    </span>
  );
}
