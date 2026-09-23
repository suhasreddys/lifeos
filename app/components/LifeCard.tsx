import React from "react";
import Link from "next/link";
import { IconArrowRight } from "./Icons";

type LifeCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  status?: string;
  theme?: "purple" | "emerald" | "amber" | "blue" | "teal" | "rose";
};

export default function LifeCard({ icon, title, description, href, status, theme = "purple" }: LifeCardProps) {
  const themeClass = `life-card--${theme}`;

  const content = (
    <>
      <div className="life-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="life-card__content">
        <div className="life-card__heading">
          <h2>{title}</h2>
          {status && <span className="life-card__status">{status}</span>}
        </div>
        <p>{description}</p>
      </div>
      <div className="life-card__arrow" aria-hidden="true">
        <IconArrowRight size={20} />
      </div>
    </>
  );

  if (href) {
    return (
      <Link className={`life-card ${themeClass}`} href={href}>
        {content}
      </Link>
    );
  }
  return <div className={`life-card life-card--coming-soon ${themeClass}`}>{content}</div>;
}
