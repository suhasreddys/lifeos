import Link from "next/link";

type LifeCardProps = {
  icon: string;
  title: string;
  description: string;
  href?: string;
  status?: string;
};

export default function LifeCard({ icon, title, description, href, status }: LifeCardProps) {
  const content = <><span className="life-card__icon" aria-hidden="true">{icon}</span><div className="life-card__content"><div className="life-card__heading"><h2>{title}</h2>{status && <span className="life-card__status">{status}</span>}</div><p>{description}</p></div><span className="life-card__arrow" aria-hidden="true">→</span></>;

  if (href) return <Link className="life-card" href={href}>{content}</Link>;
  return <div className="life-card life-card--coming-soon">{content}</div>;
}
