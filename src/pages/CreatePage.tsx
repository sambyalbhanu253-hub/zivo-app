import Icon from '../components/Icon'
import PageIntro from '../components/PageIntro'

export default function CreatePage() {
  return (
    <div className="page-content">
      <PageIntro
        description="Make a short, share a moment, and bring your perspective to ZIVO."
        eyebrow="MAKE SOMETHING"
        title={<>Your story<br /><span className="accent-text">starts here.</span></>}
      />
      <section className="feature-card create-card">
        <span className="feature-icon create-icon"><Icon name="create" size={26} /></span>
        <h2>Creator tools are coming soon</h2>
        <p>We’re getting the essentials ready for your first post.</p>
      </section>
    </div>
  )
}
