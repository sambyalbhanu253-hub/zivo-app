import Icon from '../components/Icon'
import PageIntro from '../components/PageIntro'

export default function DiscoverPage() {
  return (
    <div className="page-content">
      <PageIntro
        description="Find new perspectives, rising creators, and videos made for you."
        eyebrow="EXPLORE THE COMMUNITY"
        title={<>A little more<br /><span className="accent-text">inspiring.</span></>}
      />
      <section className="feature-card discover-card">
        <span className="feature-icon"><Icon name="discover" size={24} /></span>
        <h2>Discovery is on its way</h2>
        <p>Creator and video recommendations will appear here.</p>
      </section>
    </div>
  )
}
