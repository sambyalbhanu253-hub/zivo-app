import type { ReactNode } from 'react'

type PageIntroProps = {
  eyebrow: string
  title: ReactNode
  description: string
  children?: ReactNode
}

export default function PageIntro({ eyebrow, title, description, children }: PageIntroProps) {
  return (
    <section className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      {children}
    </section>
  )
}
